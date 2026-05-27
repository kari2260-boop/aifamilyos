"""
Prompt 自动优化服务
基于数据分析结果，生成 prompt 优化建议
管理员确认后可一键应用
"""
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.models import Message, Conversation, AgentPrompt, AgentExample
from app.services.llm_service import chat_completion


OPTIMIZATION_PROMPT = """你是一位AI系统优化专家。请根据以下数据分析结果，为这个AI Agent生成prompt优化建议。

## 当前Agent信息
- Agent类型：{agent_type}
- 当前系统提示词（前500字）：
{current_prompt}

## 数据分析
- 满意度：{satisfaction_rate}%
- 总回复数：{total_replies}
- 被标记"没用"的回复数：{not_useful_count}

## 被标记"没用"的回复样本（最多5条）
{bad_samples}

## 被标记"有用"的回复样本（最多5条）
{good_samples}

## 请输出优化建议
请以JSON格式返回：
{{
  "diagnosis": "问题诊断（1-2句话）",
  "suggestions": [
    {{
      "type": "prompt_addition",
      "content": "建议添加到prompt中的内容",
      "reason": "为什么要加这个"
    }}
  ],
  "example_to_add": {{
    "user_input": "一个好的用户输入示例",
    "assistant_output": "期望的AI回复示例",
    "reason": "为什么这是好的回复"
  }}
}}

只返回JSON。
"""


async def generate_prompt_suggestions(agent_type: str, db: Session) -> dict:
    """为指定Agent生成prompt优化建议"""
    since = datetime.utcnow() - timedelta(days=30)

    # 获取当前prompt
    agent_prompt = db.query(AgentPrompt).filter(AgentPrompt.agent_type == agent_type).first()
    current_prompt = agent_prompt.system_prompt[:500] if agent_prompt else "未配置"

    # 获取该Agent的对话统计
    agent_convs = db.query(Conversation.id).filter(
        Conversation.agent_type == agent_type,
        Conversation.created_at >= since,
    ).subquery()

    useful_count = db.query(Message).filter(
        Message.conversation_id.in_(agent_convs),
        Message.feedback == "useful",
    ).count()

    not_useful_count = db.query(Message).filter(
        Message.conversation_id.in_(agent_convs),
        Message.feedback == "not_useful",
    ).count()

    total_replies = db.query(Message).filter(
        Message.conversation_id.in_(agent_convs),
        Message.role == "assistant",
    ).count()

    total_feedback = useful_count + not_useful_count
    satisfaction_rate = round(useful_count / max(total_feedback, 1) * 100, 1)

    # 获取"没用"的回复样本
    bad_messages = db.query(Message).filter(
        Message.conversation_id.in_(agent_convs),
        Message.feedback == "not_useful",
    ).order_by(Message.created_at.desc()).limit(5).all()

    bad_samples = ""
    for msg in bad_messages:
        # 找到对应的用户问题
        user_msg = db.query(Message).filter(
            Message.conversation_id == msg.conversation_id,
            Message.role == "user",
            Message.created_at < msg.created_at,
        ).order_by(Message.created_at.desc()).first()
        if user_msg:
            bad_samples += f"用户问：{user_msg.content[:100]}\nAI答：{msg.content[:200]}\n---\n"

    # 获取"有用"的回复样本
    good_messages = db.query(Message).filter(
        Message.conversation_id.in_(agent_convs),
        Message.feedback == "useful",
    ).order_by(Message.created_at.desc()).limit(5).all()

    good_samples = ""
    for msg in good_messages:
        user_msg = db.query(Message).filter(
            Message.conversation_id == msg.conversation_id,
            Message.role == "user",
            Message.created_at < msg.created_at,
        ).order_by(Message.created_at.desc()).first()
        if user_msg:
            good_samples += f"用户问：{user_msg.content[:100]}\nAI答：{msg.content[:200]}\n---\n"

    # 数据不足时返回提示
    if total_feedback < 5:
        return {
            "agent_type": agent_type,
            "status": "insufficient_data",
            "message": f"反馈数据不足（当前{total_feedback}条，需要至少5条）",
            "satisfaction_rate": satisfaction_rate,
            "total_feedback": total_feedback,
        }

    # 调用LLM生成建议
    prompt = OPTIMIZATION_PROMPT.format(
        agent_type=agent_type,
        current_prompt=current_prompt,
        satisfaction_rate=satisfaction_rate,
        total_replies=total_replies,
        not_useful_count=not_useful_count,
        bad_samples=bad_samples or "暂无",
        good_samples=good_samples or "暂无",
    )

    messages = [{"role": "user", "content": prompt}]
    reply, _, _, _ = await chat_completion(messages, temperature=0.3, max_tokens=2000)

    # 解析JSON
    try:
        json_str = reply
        if "```" in reply:
            json_str = reply.split("```")[1].strip()
            if json_str.startswith("json"):
                json_str = json_str[4:].strip()
        suggestions = json.loads(json_str)
    except (json.JSONDecodeError, IndexError):
        suggestions = {"diagnosis": "无法解析优化建议", "suggestions": []}

    return {
        "agent_type": agent_type,
        "status": "ok",
        "satisfaction_rate": satisfaction_rate,
        "total_feedback": total_feedback,
        "total_replies": total_replies,
        "suggestions": suggestions,
        "generated_at": datetime.utcnow().isoformat(),
    }
