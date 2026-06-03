"""
错题自动抽取服务 - 从刷刷对话中解析并保存错题
"""
import json
import re
from typing import Optional, Union
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.models import WrongQuestion, Message, Conversation
from app.services.llm_service import chat_completion


async def extract_and_save_wrong_question(
    db: Session,
    conversation_id: Union[UUID, str],
    user_message: str,
    assistant_message: str,
    user_message_id: Union[UUID, str],
    assistant_message_id: Union[UUID, str],
    family_id: Union[UUID, str],
    child_id: Optional[Union[UUID, str]] = None,
    image_url: Optional[str] = None,
) -> Optional[WrongQuestion]:
    """
    从刷刷对话中自动抽取错题信息并保存。

    触发条件：
    - agent_type == "shuashua"
    - 用户消息或刷刷回答中包含题目相关内容

    返回：保存的 WrongQuestion 对象，如果不适合保存则返回 None
    """

    # 构造抽取 prompt
    extract_prompt = f"""你是一个错题信息抽取助手。从以下对话中抽取错题的结构化信息。

用户消息：
{user_message}

刷刷回答：
{assistant_message}

请抽取以下字段，如果某个字段无法确定就留空：
1. subject: 学科（数学/英语/物理/化学/语文等），必须是具体学科名，不要"理科"这种泛称
2. grade: 年级（小学/初中/高中，尽量具体到几年级）
3. question_text: 题目原文（如果用户上传图片或刷刷识别出来了，尽量还原题目文字）
4. knowledge_points: 知识点列表（数组，例如 ["二次函数", "顶点式"]）
5. mistake_reason: 错因分析（从刷刷回答的"容易错在哪里"部分提取）
6. similar_questions: 类似练习题（从刷刷回答的"给你一道类似题"部分提取）

**重要规则**：
- 如果这不是一个关于具体题目的对话（例如只是闲聊、打招呼、问学习方法），返回 {{"should_save": false}}
- 如果这是关于具体题目的讨论，返回 {{"should_save": true, "data": {{...}}}}

请严格按照 JSON 格式返回，不要有任何其他文字：
```json
{{
  "should_save": true/false,
  "data": {{
    "subject": "数学",
    "grade": "初三",
    "question_text": "...",
    "knowledge_points": ["二次函数", "顶点式"],
    "mistake_reason": "...",
    "similar_questions": "..."
  }}
}}
```"""

    try:
        # 调用 LLM 抽取
        messages = [{"role": "user", "content": extract_prompt}]
        extraction_result, _, _, _ = await chat_completion(messages)

        # 解析 JSON（容错处理）
        # 先尝试提取 ```json ... ``` 中的内容
        json_match = re.search(r'```json\s*\n(.*?)\n```', extraction_result, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = extraction_result.strip()

        result = json.loads(json_str)

        # 判断是否应该保存
        if not result.get("should_save", False):
            return None

        data = result.get("data", {})
        if not data:
            return None

        # 创建 WrongQuestion 记录
        wrong_q = WrongQuestion(
            family_id=family_id,
            child_id=child_id,
            conversation_id=conversation_id,
            message_id=assistant_message_id,
            subject=data.get("subject"),
            grade=data.get("grade"),
            question_text=data.get("question_text"),
            image_url=image_url,
            knowledge_points=data.get("knowledge_points"),
            mistake_reason=data.get("mistake_reason"),
            ai_explanation=assistant_message,  # 完整保存刷刷的回答
            similar_questions=data.get("similar_questions"),
            status="new"
        )

        db.add(wrong_q)
        db.commit()
        db.refresh(wrong_q)
        return wrong_q

    except Exception as e:
        # 抽取失败不影响对话流程，静默记录日志即可
        print(f"[错题自动抽取失败] {e}")
        return None
