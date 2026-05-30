"""
Report Service - 月度成长报告生成
汇总当月对话内容 + 画像变化，调用 LLM 生成结构化报告
"""
import json
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.models import Family, ChildProfile, Conversation, Message, GrowthReport, GrowthTag, AssessmentRecord, AssessmentTemplate
from app.services.llm_service import chat_completion


REPORT_PROMPT = """你是一位专业的儿童成长分析师。请根据以下多源数据，生成一份月度成长报告。

## 孩子信息
- 姓名：{child_name}
- 年龄：{child_age}
- 年级：{child_grade}

## 本月对话记录摘要
{conversations_summary}

## 当前成长画像
{profile_summary}

## 本月测评情况
{assessment_summary}

## 画像变化（与上月对比）
{profile_changes}

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
  "profile_changes": {{
    "new_tags": ["本月新增的成长标签"],
    "growth_moments": ["本月关键成长事件"],
    "compared_to_last_month": "与上月相比的变化描述（1-2句话）"
  }},
  "overall_suggestions": ["综合建议1", "综合建议2", "综合建议3"]
}}

注意：
- 评分要客观，基于对话内容
- profile_changes 要基于实际数据，没有变化时如实说明
- 建议要具体可执行
- 只输出 JSON，不要其他内容
"""


async def generate_monthly_report(
    family_id: str,
    child_id: Optional[str],
    month: str,  # "2026-05"
    db: Session,
) -> GrowthReport:
    """生成月度成长报告（含画像变化对比）"""
    family = db.query(Family).filter(Family.id == family_id).first()
    child = None
    if child_id:
        child = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()

    child_name = child.name if child else "孩子"
    child_age = str(child.age) + "岁" if child and child.age else "未知"
    child_grade = child.grade if child and child.grade else "未知"

    # 月份边界
    year, mon = int(month[:4]), int(month[5:7])
    month_start = f"{month}-01"
    month_end = f"{year}-{mon + 1:02d}-01" if mon < 12 else f"{year + 1}-01-01"

    # 上月字符串
    if mon == 1:
        last_month = f"{year - 1}-12"
    else:
        last_month = f"{year}-{mon - 1:02d}"

    # ── 本月对话 ──
    conversations = db.query(Conversation).filter(
        Conversation.family_id == family_id,
        Conversation.created_at >= month_start,
        Conversation.created_at < month_end,
    ).all()

    if not conversations:
        content_json = {
            "summary": "本月暂无对话记录",
            "learning": {"score": 0, "highlights": [], "suggestions": ["多和AI伙伴聊聊学习上的问题"]},
            "creativity": {"score": 0, "highlights": [], "suggestions": ["试试和创创聊聊感兴趣的项目"]},
            "talent": {"score": 0, "discoveries": [], "suggestions": ["和探探聊聊，发现孩子的天赋"]},
            "profile_changes": {"new_tags": [], "growth_moments": [], "compared_to_last_month": "本月暂无对话数据"},
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

    # ── 对话摘要 ──
    summaries = []
    for conv in conversations[:20]:
        messages = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.created_at.asc()).limit(6).all()
        conv_text = f"[{conv.agent_type}] "
        for msg in messages:
            role_label = "孩子/家长" if msg.role == "user" else "AI"
            conv_text += f"{role_label}: {msg.content[:100]}... | "
        summaries.append(conv_text[:500])
    conversations_summary = "\n".join(summaries)

    # ── 当前画像摘要 ──
    profile_lines = []
    if child:
        profile = child.ai_profile or {}
        if profile.get("summary"):
            profile_lines.append(f"画像摘要：{profile['summary']}")
        if profile.get("learning_style"):
            profile_lines.append(f"学习风格：{profile['learning_style']}")
        if profile.get("strengths"):
            profile_lines.append(f"优势：{profile['strengths']}")
        if profile.get("challenges"):
            profile_lines.append(f"挑战：{profile['challenges']}")
        if profile.get("consultant_insights"):
            profile_lines.append(f"专家洞察：{'、'.join(profile['consultant_insights'][:3])}")

        # 当前标签
        tags = db.query(GrowthTag).filter(
            GrowthTag.child_id == child.id
        ).order_by(GrowthTag.confidence.desc()).limit(10).all()
        if tags:
            tag_names = [t.tag_name for t in tags]
            profile_lines.append(f"成长标签：{'、'.join(tag_names)}")

    profile_summary = "\n".join(profile_lines) if profile_lines else "暂无画像数据"

    # ── 本月测评 ──
    assessment_lines = []
    if child_id:
        records = db.query(AssessmentRecord).filter(
            AssessmentRecord.child_id == child_id,
            AssessmentRecord.created_at >= month_start,
            AssessmentRecord.created_at < month_end,
        ).all()
        for r in records:
            tmpl = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == r.template_id).first()
            if tmpl:
                assessment_lines.append(f"完成测评：{tmpl.title}（{tmpl.category}）")
    assessment_summary = "\n".join(assessment_lines) if assessment_lines else "本月未完成测评"

    # ── 画像变化对比（与上月报告对比）──
    last_report = db.query(GrowthReport).filter(
        GrowthReport.family_id == family_id,
        GrowthReport.child_id == child_id,
        GrowthReport.month == last_month,
    ).first()

    change_lines = []
    if last_report and last_report.content_json:
        last_content = last_report.content_json

        # 分数变化
        for dim, label in [("learning", "学习"), ("creativity", "创造力"), ("talent", "天赋")]:
            last_score = (last_content.get(dim) or {}).get("score", 0)
            # 本月分数在 LLM 生成后才有，这里只记录上月基准
            if last_score and last_score > 0:
                change_lines.append(f"上月{label}评分：{last_score}/10")

        # 上月关键事件
        last_changes = last_content.get("profile_changes") or {}
        if last_changes.get("growth_moments"):
            change_lines.append(f"上月关键事件：{'；'.join(last_changes['growth_moments'][:2])}")
    else:
        change_lines.append("这是首次生成报告，暂无上月数据对比")

    # 本月新增的 key_moments
    if child and child.ai_profile:
        moments = child.ai_profile.get("key_moments", [])
        this_month_moments = [m for m in moments if m.startswith(month)]
        if this_month_moments:
            change_lines.append(f"本月新增事件：{'；'.join(this_month_moments[:3])}")

    profile_changes = "\n".join(change_lines) if change_lines else "暂无对比数据"

    # ── 调用 LLM ──
    prompt = REPORT_PROMPT.format(
        child_name=child_name,
        child_age=child_age,
        child_grade=child_grade,
        conversations_summary=conversations_summary,
        profile_summary=profile_summary,
        assessment_summary=assessment_summary,
        profile_changes=profile_changes,
    )

    messages_for_llm = [
        {"role": "system", "content": "你是专业的儿童成长分析师，请严格按JSON格式输出。"},
        {"role": "user", "content": prompt},
    ]

    reply, _, _, _ = await chat_completion(messages_for_llm, temperature=0.3, max_tokens=2000)

    # 解析 JSON
    try:
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
            "profile_changes": {"new_tags": [], "growth_moments": [], "compared_to_last_month": ""},
            "overall_suggestions": ["请重新生成报告"],
            "raw_response": reply[:500],
        }

    summary = content_json.get("summary", "")

    # 检查是否已有该月报告，有则更新
    existing = db.query(GrowthReport).filter(
        GrowthReport.family_id == family_id,
        GrowthReport.child_id == child_id,
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
