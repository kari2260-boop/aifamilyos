"""
成长画像标签服务
基于对话历史+测评结果+咨询记录，用 LLM 分析孩子的学习风格、兴趣方向、性格特点、潜力领域
"""
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import (
    GrowthTag, ChildProfile, Conversation, Message,
    AssessmentRecord, AssessmentTemplate, ConsultationRecord,
)
from app.services.llm_service import chat_completion


TAG_ANALYSIS_PROMPT = """你是一位儿童发展专家。请根据以下多源数据，分析这个孩子的特征，生成标签。

孩子信息：
- 姓名：{child_name}
- 年龄：{child_age}
- 年级：{child_grade}

## 数据来源1：最近的AI对话内容
{conversations}

## 数据来源2：测评结果
{assessment_data}

## 数据来源3：咨询师观察
{consultation_data}

请从以下4个维度分析，每个维度给出1-3个标签：

1. learning_style（学习风格）：如"视觉学习者"、"动手实践型"、"逻辑推理型"、"社交学习型"
2. interest（兴趣方向）：如"编程"、"绘画"、"音乐"、"科学实验"、"阅读"、"运动"
3. personality（性格特点）：如"好奇心强"、"内向思考"、"领导力"、"耐心"、"创造力强"
4. potential（潜力领域）：如"数学天赋"、"语言天赋"、"艺术天赋"、"社交能力"

请以 JSON 格式返回：
{{
  "tags": [
    {{"category": "learning_style", "name": "标签名", "confidence": 0.8}},
    {{"category": "interest", "name": "标签名", "confidence": 0.9}}
  ]
}}

只返回 JSON。confidence 范围 0.5-1.0。综合多个数据来源时，confidence 可以更高。
"""


async def analyze_child_tags(child_id: str, db: Session) -> list[dict]:
    """分析孩子的成长标签（整合对话+测评+咨询数据）"""
    child = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not child:
        raise ValueError("孩子不存在")

    # === 数据来源1：对话记录 ===
    since = datetime.utcnow() - timedelta(days=30)
    conversations = db.query(Conversation).filter(
        Conversation.family_id == child.family_id,
        Conversation.created_at >= since,
    ).order_by(Conversation.created_at.desc()).limit(10).all()

    conv_texts = []
    for conv in conversations:
        messages = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.created_at.asc()).limit(20).all()

        if messages:
            text = f"\n[{conv.agent_type}对话]\n"
            for m in messages:
                role_label = "孩子/家长" if m.role == "user" else "AI导师"
                text += f"{role_label}: {m.content[:200]}\n"
            conv_texts.append(text)

    conversations_text = "\n---\n".join(conv_texts[:5]) if conv_texts else "暂无对话记录"

    # === 数据来源2：测评结果 ===
    assessment_records = db.query(AssessmentRecord).filter(
        AssessmentRecord.child_id == child_id,
    ).order_by(AssessmentRecord.created_at.desc()).limit(5).all()

    assessment_texts = []
    for ar in assessment_records:
        template = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == ar.template_id).first()
        if template and ar.answers_json:
            text = f"[{template.title}] 答题结果：\n"
            for ans in ar.answers_json[:10]:
                q_idx = ans.get("question_index", 0)
                if q_idx < len(template.questions_json):
                    q = template.questions_json[q_idx]
                    text += f"  Q: {q.get('question', '')} → 选择: {ans.get('selected_value', '')}\n"
            assessment_texts.append(text)

    assessment_data = "\n".join(assessment_texts) if assessment_texts else "暂无测评数据"

    # === 数据来源3：咨询记录 ===
    consultation_records = db.query(ConsultationRecord).filter(
        ConsultationRecord.child_id == child_id,
        ConsultationRecord.status == "completed",
    ).order_by(ConsultationRecord.created_at.desc()).limit(3).all()

    consultation_texts = []
    for cr in consultation_records:
        if cr.summary:
            consultation_texts.append(f"咨询总结：{cr.summary[:300]}")
        if cr.key_findings:
            consultation_texts.append(f"关键发现：{', '.join(cr.key_findings[:5])}")

    consultation_data = "\n".join(consultation_texts) if consultation_texts else "暂无咨询记录"

    # === 检查是否有足够数据 ===
    if not conv_texts and not assessment_records and not consultation_records:
        raise ValueError("数据不足，无法分析。请先进行对话、测评或咨询。")

    # === 调用 LLM ===
    prompt = TAG_ANALYSIS_PROMPT.format(
        child_name=child.name,
        child_age=child.age or "未知",
        child_grade=child.grade or "未知",
        conversations=conversations_text,
        assessment_data=assessment_data,
        consultation_data=consultation_data,
    )

    messages = [{"role": "user", "content": prompt}]
    reply, _, _, _ = await chat_completion(messages, temperature=0.3, max_tokens=1500)

    # 解析 JSON
    try:
        json_str = reply
        if "```" in reply:
            json_str = reply.split("```")[1].strip()
            if json_str.startswith("json"):
                json_str = json_str[4:].strip()
        data = json.loads(json_str)
        tags = data.get("tags", [])
    except (json.JSONDecodeError, IndexError):
        tags = []

    # 清除旧的AI标签，写入新标签
    db.query(GrowthTag).filter(
        GrowthTag.child_id == child_id,
        GrowthTag.source == "ai",
    ).delete()

    new_tags = []
    for t in tags:
        tag = GrowthTag(
            child_id=child_id,
            tag_name=t.get("name", ""),
            tag_category=t.get("category", "interest"),
            confidence=min(max(float(t.get("confidence", 0.7)), 0.5), 1.0),
            source="ai",
        )
        db.add(tag)
        new_tags.append({
            "tag_name": tag.tag_name,
            "tag_category": tag.tag_category,
            "confidence": tag.confidence,
        })

    db.commit()
    return new_tags
