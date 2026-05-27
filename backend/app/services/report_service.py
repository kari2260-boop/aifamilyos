"""
Report Service - 月度成长报告生成
汇总当月对话内容，调用 LLM 生成结构化报告
"""
import json
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.models import Family, ChildProfile, Conversation, Message, GrowthReport
from app.services.llm_service import chat_completion


REPORT_PROMPT = """你是一位专业的儿童成长分析师。请根据以下对话记录，生成一份月度成长报告。

## 孩子信息
- 姓名：{child_name}
- 年龄：{child_age}
- 年级：{child_grade}

## 本月对话记录摘要
{conversations_summary}

## 输出要求
请以 JSON 格式输出报告，包含以下字段：
{{
  "summary": "一句话总结本月成长亮点（20字以内）",
  "learning": {{
    "score": 1-10的评分,
    "highlights": ["学习方面的亮点1", "亮点2"],
    "suggestions": ["建议1", "建议2"]
  }},
  "creativity": {{
    "score": 1-10的评分,
    "highlights": ["创造力方面的亮点1"],
    "suggestions": ["建议1"]
  }},
  "talent": {{
    "score": 1-10的评分,
    "discoveries": ["发现的天赋/兴趣方向1"],
    "suggestions": ["培养建议1"]
  }},
  "overall_suggestions": ["综合建议1", "综合建议2", "综合建议3"]
}}

注意：
- 评分要客观，基于对话内容
- 如果某个维度对话较少，评分可以给5分并说明数据不足
- 建议要具体可执行
- 只输出 JSON，不要其他内容
"""


async def generate_monthly_report(
    family_id: str,
    child_id: Optional[str],
    month: str,  # "2026-05"
    db: Session,
) -> GrowthReport:
    """生成月度成长报告"""
    # 获取家庭和孩子信息
    family = db.query(Family).filter(Family.id == family_id).first()
    child = None
    if child_id:
        child = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()

    child_name = child.name if child else "孩子"
    child_age = str(child.age) + "岁" if child and child.age else "未知"
    child_grade = child.grade if child and child.grade else "未知"

    # 获取当月对话
    month_start = f"{month}-01"
    # 简单处理月末
    year, mon = int(month[:4]), int(month[5:7])
    if mon == 12:
        month_end = f"{year + 1}-01-01"
    else:
        month_end = f"{year}-{mon + 1:02d}-01"

    conversations = db.query(Conversation).filter(
        Conversation.family_id == family_id,
        Conversation.created_at >= month_start,
        Conversation.created_at < month_end,
    ).all()

    if not conversations:
        # 没有对话，生成空报告
        content_json = {
            "summary": "本月暂无对话记录",
            "learning": {"score": 0, "highlights": [], "suggestions": ["多和AI伙伴聊聊学习上的问题"]},
            "creativity": {"score": 0, "highlights": [], "suggestions": ["试试和创创聊聊感兴趣的项目"]},
            "talent": {"score": 0, "discoveries": [], "suggestions": ["和探探聊聊，发现孩子的天赋"]},
            "overall_suggestions": ["本月对话较少，建议每周至少和AI伙伴交流2-3次"],
        }
        report = GrowthReport(
            family_id=family_id,
            child_id=child_id,
            month=month,
            summary="本月暂无对话记录",
            content_json=content_json,
            conversation_count=0,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    # 汇总对话内容（取每个对话的前几轮）
    summaries = []
    for conv in conversations[:20]:  # 最多取20个对话
        messages = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.created_at.asc()).limit(6).all()

        conv_text = f"[{conv.agent_type}] "
        for msg in messages:
            role_label = "孩子/家长" if msg.role == "user" else "AI"
            conv_text += f"{role_label}: {msg.content[:100]}... | "
        summaries.append(conv_text[:500])

    conversations_summary = "\n".join(summaries)

    # 调用 LLM 生成报告
    prompt = REPORT_PROMPT.format(
        child_name=child_name,
        child_age=child_age,
        child_grade=child_grade,
        conversations_summary=conversations_summary,
    )

    messages_for_llm = [
        {"role": "system", "content": "你是专业的儿童成长分析师，请严格按JSON格式输出。"},
        {"role": "user", "content": prompt},
    ]

    reply, _, _, _ = await chat_completion(messages_for_llm, temperature=0.3, max_tokens=2000)

    # 解析 JSON
    try:
        # 尝试提取 JSON（LLM 可能会包裹在 ```json ``` 中）
        json_str = reply.strip()
        if json_str.startswith("```"):
            json_str = json_str.split("\n", 1)[1]
            json_str = json_str.rsplit("```", 1)[0]
        content_json = json.loads(json_str)
    except (json.JSONDecodeError, IndexError):
        content_json = {
            "summary": "报告生成中遇到问题，请重试",
            "learning": {"score": 5, "highlights": [], "suggestions": []},
            "creativity": {"score": 5, "highlights": [], "suggestions": []},
            "talent": {"score": 5, "discoveries": [], "suggestions": []},
            "overall_suggestions": ["请重新生成报告"],
            "raw_response": reply[:500],
        }

    summary = content_json.get("summary", "")

    # 检查是否已有该月报告，有则更新
    existing = db.query(GrowthReport).filter(
        GrowthReport.family_id == family_id,
        GrowthReport.month == month,
    ).first()

    if existing:
        existing.content_json = content_json
        existing.summary = summary
        existing.conversation_count = len(conversations)
        existing.generated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    report = GrowthReport(
        family_id=family_id,
        child_id=child_id,
        month=month,
        summary=summary,
        content_json=content_json,
        conversation_count=len(conversations),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
