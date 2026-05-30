"""
孩子画像异步更新服务（P1 + P2）

触发时机：
  P1 - 每个对话满 5 轮（10条消息）时，后台异步调用
  P2 - 测评提交后、咨询记录完成后自动触发
作用：从多源数据中提取新信息，合并更新 ChildProfile.ai_profile。
隔离保证：所有操作以 child_id 为主键，不同孩子完全独立。
"""
import json
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import ChildProfile, Conversation, Message, GrowthTag
from app.services.llm_service import chat_completion


PROFILE_EXTRACT_PROMPT = """你是一位儿童成长档案专家。请根据以下对话内容，提取关于这个孩子的新信息，用于更新孩子的成长画像。

## 孩子基本信息
- 姓名：{child_name}
- 年龄：{child_age}
- 年级：{child_grade}

## 当前已有画像
{current_profile}

## 最近的对话内容
{conversation_text}

请从对话中提取新的、有价值的信息，只提取对话中明确提到的内容，不要推测。

以 JSON 格式返回，只返回有新信息的字段，没有新信息的字段不要包含：
{{
  "interests": "更新后的兴趣描述（如有新兴趣）",
  "learning_style": "学习风格描述（如有新发现）",
  "challenges": "学习或生活挑战（如有新挑战）",
  "strengths": "优势和亮点（如有新发现）",
  "key_moments": ["新的关键事件，格式：YYYY-MM 事件描述"],
  "parent_concerns": "家长关注点（如有新关注）",
  "summary_update": "一句话更新画像摘要（如有重要新信息）"
}}

只返回 JSON，没有新信息时返回空对象 {{}}。
"""


def _get_message_count(conversation_id, db: Session) -> int:
    return db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).count()


def _should_update_profile(conversation_id, db: Session) -> bool:
    """每满5轮（10条消息）触发一次更新"""
    count = _get_message_count(conversation_id, db)
    return count > 0 and count % 10 == 0


async def update_child_profile_from_conversation(
    child_id,
    conversation_id,
    db: Session,
) -> bool:
    """
    从对话中提取信息，异步更新孩子画像。
    返回 True 表示有更新，False 表示无需更新或失败。
    """
    child = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not child:
        return False

    # 取最近20条消息
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.desc()).limit(20).all()
    messages = list(reversed(messages))

    if not messages:
        return False

    # 构建对话文本
    conv_lines = []
    for m in messages:
        role = "家长" if m.role == "user" else "AI导师"
        conv_lines.append(f"{role}: {m.content[:300]}")
    conversation_text = "\n".join(conv_lines)

    # 当前画像
    current = child.ai_profile or {}
    current_profile_text = json.dumps(current, ensure_ascii=False, indent=2) if current else "暂无"

    prompt = PROFILE_EXTRACT_PROMPT.format(
        child_name=child.name,
        child_age=child.age or "未知",
        child_grade=child.grade or "未知",
        current_profile=current_profile_text,
        conversation_text=conversation_text,
    )

    try:
        reply, _, _, _ = await chat_completion(
            [{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=800,
        )

        # 解析 JSON
        json_str = reply.strip()
        if "```" in json_str:
            json_str = json_str.split("```")[1].strip()
            if json_str.startswith("json"):
                json_str = json_str[4:].strip()

        extracted = json.loads(json_str)
        if not extracted:
            return False

    except Exception as e:
        print(f"[ProfileUpdate] 提取失败 child={child_id}: {e}")
        return False

    # 合并到现有画像
    updated = dict(current)

    if "interests" in extracted:
        updated["interests"] = extracted["interests"]
    if "learning_style" in extracted:
        updated["learning_style"] = extracted["learning_style"]
    if "challenges" in extracted:
        updated["challenges"] = extracted["challenges"]
    if "strengths" in extracted:
        updated["strengths"] = extracted["strengths"]
    if "parent_concerns" in extracted:
        updated["parent_concerns"] = extracted["parent_concerns"]
    if "summary_update" in extracted:
        updated["summary"] = extracted["summary_update"]

    # 追加关键事件（不覆盖，只追加新的）
    if "key_moments" in extracted and extracted["key_moments"]:
        existing_moments = updated.get("key_moments", [])
        for moment in extracted["key_moments"]:
            if moment not in existing_moments:
                existing_moments.append(moment)
        updated["key_moments"] = existing_moments[-20:]  # 最多保留20条

    updated["last_updated"] = datetime.utcnow().strftime("%Y-%m-%d")

    # 写回数据库（新建 session 避免与请求 session 冲突）
    from app.database import SessionLocal
    save_db = SessionLocal()
    try:
        c = save_db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
        if c:
            c.ai_profile = updated
            save_db.commit()
            print(f"[ProfileUpdate] 画像已更新 child={child_id} name={c.name}")
            return True
    except Exception as e:
        print(f"[ProfileUpdate] 写入失败 child={child_id}: {e}")
        save_db.rollback()
    finally:
        save_db.close()

    return False


async def maybe_update_profile(child_id, conversation_id, db: Session):
    """
    检查是否需要更新画像，满足条件则后台触发（fire-and-forget）。
    在 chat 路由保存消息后调用，不阻塞响应。
    """
    if child_id is None:
        return
    if not _should_update_profile(conversation_id, db):
        return

    # fire-and-forget：不等待结果，不影响对话响应速度
    asyncio.create_task(
        update_child_profile_from_conversation(child_id, conversation_id, db)
    )


# ============ P2：测评完成后更新画像 ============

def _merge_profile(child: ChildProfile, updates: dict, db) -> None:
    """将 updates 合并写入 child.ai_profile，使用独立 session。"""
    from app.database import SessionLocal
    save_db = SessionLocal()
    try:
        c = save_db.query(ChildProfile).filter(ChildProfile.id == child.id).first()
        if not c:
            return
        current = dict(c.ai_profile or {})
        for k, v in updates.items():
            if k == "key_moments" and isinstance(v, list):
                existing = current.get("key_moments", [])
                for m in v:
                    if m not in existing:
                        existing.append(m)
                current["key_moments"] = existing[-20:]
            else:
                current[k] = v
        current["last_updated"] = datetime.utcnow().strftime("%Y-%m-%d")
        c.ai_profile = current
        save_db.commit()
        print(f"[ProfileUpdate] P2 画像已更新 child={child.id} name={c.name}")
    except Exception as e:
        print(f"[ProfileUpdate] P2 写入失败 child={child.id}: {e}")
        save_db.rollback()
    finally:
        save_db.close()


async def update_profile_from_assessment(child_id, record_id, db: Session) -> None:
    """
    P2-测评：测评提交后，把测评结论合并进孩子画像。
    从 AssessmentRecord + AssessmentReport 提取结构化结论。
    """
    from app.models.models import AssessmentRecord, AssessmentTemplate, AssessmentReport

    child = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not child:
        return

    record = db.query(AssessmentRecord).filter(AssessmentRecord.id == record_id).first()
    if not record:
        return

    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == record.template_id
    ).first()

    # 构建测评摘要文本
    summary_parts = []
    if template:
        summary_parts.append(f"完成测评：{template.title}（{template.category}）")

    report = db.query(AssessmentReport).filter(
        AssessmentReport.record_id == record_id
    ).first()
    if report and report.ai_content_json:
        content = report.ai_content_json
        if isinstance(content, dict):
            if content.get("summary"):
                summary_parts.append(f"测评结论：{content['summary']}")
            if content.get("strengths"):
                summary_parts.append(f"优势：{content['strengths']}")
            if content.get("suggestions"):
                summary_parts.append(f"建议：{content['suggestions']}")

    if not summary_parts:
        return

    summary_text = "；".join(summary_parts)
    date_str = datetime.utcnow().strftime("%Y-%m")
    moment = f"{date_str} {summary_text[:80]}"

    updates = {
        "key_moments": [moment],
        "last_assessment": summary_text[:200],
    }

    _merge_profile(child, updates, db)


async def update_profile_from_consultation(child_id, record_id, db: Session) -> None:
    """
    P2-咨询：咨询记录完成后，把顾问观察合并进孩子画像。
    key_findings 是顾问填写的专业观察，置信度最高。
    """
    from app.models.models import ConsultationRecord

    child = db.query(ChildProfile).filter(ChildProfile.id == child_id).first()
    if not child:
        return

    record = db.query(ConsultationRecord).filter(
        ConsultationRecord.id == record_id
    ).first()
    if not record:
        return

    updates: dict = {}
    date_str = datetime.utcnow().strftime("%Y-%m")

    # 顾问总结 → 画像摘要
    if record.summary:
        updates["consultant_summary"] = record.summary[:300]
        updates["key_moments"] = [f"{date_str} 咨询：{record.summary[:60]}"]

    # key_findings → 专家洞察字段
    if record.key_findings:
        updates["consultant_insights"] = record.key_findings[:10]

    # plan_json 里的目标 → 家长期望补充
    if record.plan_json and isinstance(record.plan_json, dict):
        goals = record.plan_json.get("goals", [])
        if goals:
            updates["consultant_goals"] = goals[:5]

    if not updates:
        return

    _merge_profile(child, updates, db)

