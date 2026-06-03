"""
Chat Router - 对话接口
POST /chat/send        发送消息并获取AI回复（非流式，兼容旧版）
POST /chat/stream      发送消息并流式返回AI回复（SSE）
POST /chat/transcribe  语音文件转文字（微信H5录音上传）
POST /chat/upload-image 用户上传图片（进消息管道）
GET  /chat/conversations  获取对话列表
GET  /chat/conversations/{id}/messages  获取对话历史
"""
from uuid import UUID
from typing import List
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

from app.database import get_db
from app.utils.auth import get_current_user
from app.models.models import User, Family, Conversation, Message, UsageLog, RiskFlag, ChildProfile, GrowthTag
from app.schemas.chat import (
    ChatSendRequest, ChatSendResponse,
    ConversationListItem, MessageItem, Attachment,
)
from typing import List as TypingList
from app.services.llm_service import chat_completion, chat_completion_stream
from app.services.agent_prompts import get_agent_prompt
from app.services.rag_service import retrieve_context
from app.services.safety_service import check_risk, CRISIS_RESPONSE
from app.services.profile_update_service import maybe_update_profile
from app.services.vision_service import describe_image

router = APIRouter(prefix="/chat", tags=["chat"])

VALID_AGENTS = {"xuexue", "chuangchuang", "tantan", "banban", "shuashua"}


async def build_attachment_context(attachments: TypingList[Attachment]) -> str:
    """
    把结构化附件转成文字描述，注入 user message。
    图片会先调用视觉模型生成摘要，再交给当前文本智能体继续回答。
    """
    if not attachments:
        return ""
    lines = []
    for att in attachments:
        if att.type == "image":
            name_hint = f"（{att.name}）" if att.name else ""
            image_summary = await describe_image(att.url, att.name)
            lines.append(
                f"[用户上传了图片{name_hint}，URL：{att.url}]\n"
                f"图片识别结果：\n{image_summary}"
            )
        elif att.type == "audio":
            lines.append(f"[用户上传了语音文件，URL：{att.url}]")
        elif att.type == "file":
            name_hint = f"（{att.name}）" if att.name else ""
            lines.append(f"[用户上传了文件{name_hint}，URL：{att.url}]")
    return "\n".join(lines)


def build_child_context(child_id, family_id: str, db: Session) -> str:
    """
    根据 child_id 构建孩子画像上下文，注入 system prompt。
    - 有 child_id：精确查该孩子
    - 无 child_id：家庭只有1个孩子时自动使用，多孩子时不注入（避免猜错）
    返回空字符串表示无可用画像。
    """
    child = None

    if child_id:
        child = db.query(ChildProfile).filter(
            ChildProfile.id == child_id,
            ChildProfile.family_id == family_id,
        ).first()
    else:
        children = db.query(ChildProfile).filter(
            ChildProfile.family_id == family_id,
        ).all()
        if len(children) == 1:
            child = children[0]

    if not child:
        return ""

    lines = [
        "## 当前孩子档案（请基于以下信息个性化回答）",
        f"- 姓名：{child.name}",
    ]
    if child.age:
        lines.append(f"- 年龄：{child.age}岁")
    if child.grade:
        lines.append(f"- 年级：{child.grade}")
    if child.interests:
        lines.append(f"- 兴趣爱好：{child.interests}")
    if child.learning_challenges:
        lines.append(f"- 学习挑战：{child.learning_challenges}")
    if child.parent_expectations:
        lines.append(f"- 家长期望：{child.parent_expectations}")

    # 成长标签
    tags = db.query(GrowthTag).filter(
        GrowthTag.child_id == child.id,
    ).order_by(GrowthTag.confidence.desc()).all()

    if tags:
        tag_by_category: dict[str, list[str]] = {}
        for t in tags:
            tag_by_category.setdefault(t.tag_category, []).append(t.tag_name)

        category_labels = {
            "learning_style": "学习风格",
            "interest": "兴趣方向",
            "personality": "性格特点",
            "potential": "潜力领域",
        }
        tag_lines = []
        for cat, names in tag_by_category.items():
            label = category_labels.get(cat, cat)
            tag_lines.append(f"  - {label}：{'、'.join(names)}")
        lines.append("- AI 成长画像标签：")
        lines.extend(tag_lines)

    # ai_profile 积累的动态画像（P1/P2 持续更新）
    profile = child.ai_profile or {}
    if profile.get("summary"):
        lines.append(f"- 画像摘要：{profile['summary']}")
    if profile.get("learning_style"):
        lines.append(f"- 学习风格（AI观察）：{profile['learning_style']}")
    if profile.get("strengths"):
        lines.append(f"- 优势亮点：{profile['strengths']}")
    if profile.get("challenges"):
        lines.append(f"- 当前挑战：{profile['challenges']}")
    if profile.get("consultant_summary"):
        lines.append(f"- 顾问观察：{profile['consultant_summary']}")
    if profile.get("consultant_insights"):
        lines.append(f"- 专家洞察：{'、'.join(profile['consultant_insights'][:5])}")
    if profile.get("key_moments"):
        recent = profile["key_moments"][-3:]  # 只取最近3条，避免 prompt 过长
        lines.append(f"- 近期关键事件：{'；'.join(recent)}")

    lines.append("请在回答中充分考虑这个孩子的特点，给出个性化的建议。")
    return "\n".join(lines)


@router.post("/send", response_model=ChatSendResponse)
async def send_message(
    req: ChatSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发送消息给AI Agent并获取回复"""
    # 验证 agent_type
    if req.agent_type not in VALID_AGENTS:
        raise HTTPException(status_code=400, detail=f"无效的agent_type: {req.agent_type}")

    # 获取用户的家庭
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=400, detail="请先创建家庭档案")

    # 配额检查（统一看 subscription_plan，monthly_quota=NULL 表示不限）
    current_month = date.today().strftime("%Y-%m")
    used = db.query(func.count(UsageLog.id)).filter(
        UsageLog.family_id == family.id,
        UsageLog.action_type == "chat",
        func.to_char(UsageLog.created_at, "YYYY-MM") == current_month,
    ).scalar() or 0

    quota = family.monthly_quota  # None = 不限
    if quota is not None and used >= quota:
        raise HTTPException(
            status_code=429,
            detail=f"本月对话次数已用完（{used}/{quota}），请升级套餐解锁更多对话"
        )

    # 获取或创建对话
    if req.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == req.conversation_id,
            Conversation.family_id == family.id,
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="对话不存在")
    else:
        conversation = Conversation(
            family_id=family.id,
            child_id=req.child_id,
            agent_type=req.agent_type,
            title=req.message[:50],
        )
        db.add(conversation)
        db.flush()

    # 保存用户消息
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    db.flush()

    # 构建消息历史（最近10轮）
    history = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at.asc()).all()

    # 系统提示词（优先从DB读取，fallback到硬编码）
    system_prompt = get_agent_prompt(req.agent_type, db)

    # 注入孩子画像（P0：个性化核心）
    child_context = build_child_context(req.child_id, family.id, db)
    if child_context:
        system_prompt += f"\n\n{child_context}"

    # RAG 检索知识库（3个分类并行搜索，节省2-3秒）
    import asyncio
    agent_category_map = {
        "xuexue": "learning",
        "chuangchuang": "project",
        "tantan": "talent",
        "banban": "parenting",
        "shuashua": "learning",  # 刷刷用 learning 知识库（真题、课本、考点）
    }
    category = agent_category_map.get(req.agent_type)
    (rag_context, retrieved_chunks), (global_context, global_chunks), (product_context, product_chunks) = await asyncio.gather(
        retrieve_context(req.message, category, db, top_k=5),
        retrieve_context(req.message, "global", db, top_k=2),
        retrieve_context(req.message, "product", db, top_k=2),
    )
    if global_context:
        rag_context = (rag_context + "\n---\n" + global_context) if rag_context else global_context
        if global_chunks:
            retrieved_chunks = (retrieved_chunks or []) + global_chunks
    if product_context:
        rag_context = (rag_context + "\n---\n" + product_context) if rag_context else product_context
        if product_chunks:
            retrieved_chunks = (retrieved_chunks or []) + product_chunks

    if rag_context:
        system_prompt += f"\n\n## 参考知识（重要！请务必结合以下内容回答）\n以下是与用户问题高度相关的专业知识，请在回答时充分引用和参考这些内容，用你的专业视角重新组织表达：\n\n{rag_context}"

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history[-20:]:  # 最多取最近20条
        messages.append({"role": msg.role, "content": msg.content})

    # 构造当前用户消息：文本 + 附件描述
    user_content = req.message
    if req.attachments:
        attachment_desc = await build_attachment_context(req.attachments)
        user_content = f"{req.message}\n\n{attachment_desc}"

    messages.append({"role": "user", "content": user_content})

    # 调用大模型
    reply_content, tokens_in, tokens_out, model_used = await chat_completion(messages)

    # 风险检测
    risk_level, risk_type = check_risk(req.message)
    if risk_level == "high":
        reply_content += CRISIS_RESPONSE
        risk_flag = RiskFlag(
            family_id=family.id,
            message_id=user_msg.id,
            risk_type=risk_type or "self_harm",
            risk_level=risk_level,
            content_snapshot=req.message[:500],
        )
        db.add(risk_flag)
    elif risk_level == "medium":
        risk_flag = RiskFlag(
            family_id=family.id,
            message_id=user_msg.id,
            risk_type=risk_type or "self_harm",
            risk_level=risk_level,
            content_snapshot=req.message[:500],
        )
        db.add(risk_flag)

    # 保存AI回复
    ai_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=reply_content,
        model_name=model_used,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
        retrieved_chunks=retrieved_chunks,
    )
    db.add(ai_msg)

    # 记录用量
    usage = UsageLog(
        family_id=family.id,
        user_id=current_user.id,
        action_type="chat",
        agent_type=req.agent_type,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
    )
    db.add(usage)

    db.commit()

    # P1：后台异步更新孩子画像（fire-and-forget，不阻塞响应）
    await maybe_update_profile(req.child_id or conversation.child_id, conversation.id, db)

    return ChatSendResponse(
        conversation_id=conversation.id,
        reply=reply_content,
        model_used=model_used,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
        remaining_quota=None if quota is None else max(0, quota - used - 1),
    )


@router.post("/stream")
async def stream_message(
    req: ChatSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """流式发送消息给AI Agent，SSE格式逐块返回"""
    if req.agent_type not in VALID_AGENTS:
        raise HTTPException(status_code=400, detail=f"无效的agent_type: {req.agent_type}")

    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=400, detail="请先创建家庭档案")

    current_month = date.today().strftime("%Y-%m")
    used = db.query(func.count(UsageLog.id)).filter(
        UsageLog.family_id == family.id,
        UsageLog.action_type == "chat",
        func.to_char(UsageLog.created_at, "YYYY-MM") == current_month,
    ).scalar() or 0

    quota = family.monthly_quota  # None = 不限量
    if quota is not None and used >= quota:
        raise HTTPException(
            status_code=429,
            detail=f"本月对话次数已用完（{used}/{quota}），请升级套餐解锁更多对话"
        )

    # 获取或创建对话
    if req.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == req.conversation_id,
            Conversation.family_id == family.id,
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="对话不存在")
    else:
        conversation = Conversation(
            family_id=family.id,
            child_id=req.child_id,
            agent_type=req.agent_type,
            title=req.message[:50],
        )
        db.add(conversation)
        db.flush()

    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    db.flush()
    db.commit()

    conversation_id = str(conversation.id)
    user_msg_id = str(user_msg.id)

    history = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at.asc()).all()

    system_prompt = get_agent_prompt(req.agent_type, db)

    # 注入孩子画像（P0：个性化核心）
    child_context = build_child_context(req.child_id, family.id, db)
    if child_context:
        system_prompt += f"\n\n{child_context}"

    import asyncio
    agent_category_map = {
        "xuexue": "learning",
        "chuangchuang": "project",
        "tantan": "talent",
        "banban": "parenting",
        "shuashua": "learning",  # 刷刷用 learning 知识库（真题、课本、考点）
    }
    category = agent_category_map.get(req.agent_type)
    (rag_context, retrieved_chunks), (global_context, global_chunks), (product_context, product_chunks) = await asyncio.gather(
        retrieve_context(req.message, category, db, top_k=5),
        retrieve_context(req.message, "global", db, top_k=2),
        retrieve_context(req.message, "product", db, top_k=2),
    )
    if global_context:
        rag_context = (rag_context + "\n---\n" + global_context) if rag_context else global_context
        if global_chunks:
            retrieved_chunks = (retrieved_chunks or []) + global_chunks
    if product_context:
        rag_context = (rag_context + "\n---\n" + product_context) if rag_context else product_context
        if product_chunks:
            retrieved_chunks = (retrieved_chunks or []) + product_chunks

    if rag_context:
        system_prompt += f"\n\n## 参考知识（重要！请务必结合以下内容回答）\n以下是与用户问题高度相关的专业知识，请在回答时充分引用和参考这些内容，用你的专业视角重新组织表达：\n\n{rag_context}"

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-20:]:
        messages.append({"role": msg.role, "content": msg.content})

    # 构造当前用户消息：文本 + 附件描述
    user_content = req.message
    if req.attachments:
        attachment_desc = await build_attachment_context(req.attachments)
        user_content = f"{req.message}\n\n{attachment_desc}"

    messages.append({"role": "user", "content": user_content})

    risk_level, risk_type = check_risk(req.message)

    # 提前提取纯值，避免 generator 里 ORM 对象 session 失效
    _family_id = str(family.id)
    _user_id = str(current_user.id)
    _conversation_id = conversation_id  # 已经是 str
    _user_msg_id = user_msg_id          # 已经是 str
    _child_id_for_update = str(req.child_id or conversation.child_id) if (req.child_id or conversation.child_id) else None

    async def generate():
        full_reply = ""
        tokens_in = 0
        tokens_out = 0
        model_used = "unknown"

        # 先发送 conversation_id，前端需要用来关联后续消息
        yield f"data: {json.dumps({'conversation_id': conversation_id}, ensure_ascii=False)}\n\n"

        async for chunk in chat_completion_stream(messages):
            if not chunk.startswith("data:"):
                continue
            raw = chunk[5:].strip()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if "content" in data:
                full_reply += data["content"]
                yield chunk
            elif data.get("done"):
                usage = data.get("usage", {})
                tokens_in = usage.get("input", 0)
                tokens_out = usage.get("output", 0)
                model_used = data.get("model", "unknown")

        # 风险检测
        if risk_level == "high":
            full_reply += CRISIS_RESPONSE
            yield f"data: {json.dumps({'content': CRISIS_RESPONSE}, ensure_ascii=False)}\n\n"

        # 保存AI回复到数据库
        from app.database import SessionLocal
        save_db = SessionLocal()
        try:
            if risk_level in ("high", "medium"):
                save_db.add(RiskFlag(
                    family_id=_family_id,
                    message_id=_user_msg_id,
                    risk_type=risk_type or "self_harm",
                    risk_level=risk_level,
                    content_snapshot=req.message[:500],
                ))
            ai_msg = Message(
                conversation_id=_conversation_id,
                role="assistant",
                content=full_reply,
                model_name=model_used,
                tokens_input=tokens_in,
                tokens_output=tokens_out,
                retrieved_chunks=retrieved_chunks,
            )
            save_db.add(ai_msg)
            save_db.add(UsageLog(
                family_id=_family_id,
                user_id=_user_id,
                action_type="chat",
                agent_type=req.agent_type,
                tokens_input=tokens_in,
                tokens_output=tokens_out,
            ))
            save_db.commit()
            ai_msg_id = str(ai_msg.id)
        except Exception as e:
            print(f"[Stream] 保存消息失败: {e}")
            ai_msg_id = ""
        finally:
            save_db.close()

        # P1：后台异步更新孩子画像（fire-and-forget）
        if _child_id_for_update:
            async def update_profile_with_new_session():
                from app.database import SessionLocal
                profile_db = SessionLocal()
                try:
                    await maybe_update_profile(_child_id_for_update, _conversation_id, profile_db)
                finally:
                    profile_db.close()

            asyncio.create_task(update_profile_with_new_session())

        # 发送结束信号，携带消息ID和剩余配额
        yield f"data: {json.dumps({'done': True, 'ai_message_id': ai_msg_id, 'remaining_quota': None if quota is None else max(0, quota - used - 1)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 关闭 nginx 缓冲，确保实时推送
        },
    )



def list_conversations(
    agent_type: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的对话列表"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        return []

    query = db.query(Conversation).filter(Conversation.family_id == family.id)
    if agent_type:
        query = query.filter(Conversation.agent_type == agent_type)

    conversations = query.order_by(Conversation.updated_at.desc()).limit(50).all()
    return conversations


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageItem])
def get_messages(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取某个对话的消息历史"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.family_id == family.id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="对话不存在")

    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()
    return messages


@router.post("/messages/{message_id}/feedback")
def submit_feedback(
    message_id: UUID,
    feedback_type: str,  # useful / not_useful
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交消息反馈（有用/没用）"""
    if feedback_type not in ("useful", "not_useful"):
        raise HTTPException(status_code=400, detail="feedback_type 必须是 useful 或 not_useful")

    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")

    # 验证权限：只能对自己家庭的对话消息反馈
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    conversation = db.query(Conversation).filter(
        Conversation.id == message.conversation_id,
        Conversation.family_id == family.id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=403, detail="无权操作")

    from datetime import datetime
    message.feedback = feedback_type
    message.feedback_at = datetime.utcnow()
    db.commit()

    return {"status": "ok", "feedback": feedback_type}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除整个对话"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.family_id == family.id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="对话不存在")

    db.query(Message).filter(Message.conversation_id == conversation_id).delete()
    db.delete(conversation)
    db.commit()
    return {"status": "ok"}


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除单条消息"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")

    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    conversation = db.query(Conversation).filter(
        Conversation.id == message.conversation_id,
        Conversation.family_id == family.id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=403, detail="无权操作")

    db.delete(message)
    db.commit()
    return {"status": "ok"}


@router.post("/transcribe")
async def transcribe_audio_to_text(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    微信 H5 语音转文字接口
    接收音频文件（webm/mp3/wav），调用 DashScope 转写，返回文本
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名为空")

    # 读取音频内容
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="音频文件为空")

    # 限制大小（10MB）
    MAX_AUDIO_SIZE = 10 * 1024 * 1024
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=400, detail="音频文件超过10MB限制")

    # 调用转写服务
    from app.services.transcribe_service import transcribe_audio
    try:
        text = await transcribe_audio(audio_bytes, file.content_type or "audio/webm")
        return {"text": text, "status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"语音转写失败: {str(e)}")


@router.post("/upload-image")
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    用户上传图片进入 chat 消息管道（微信 H5 拍照/相册）
    注意：当前版本只做上传留痕，LLM 为纯文本模型，不直接理解图片内容
    后续接入多模态模型时，此接口返回的 URL 可直接作为 image_url 传给模型
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名为空")

    ALLOWED_IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB

    import os, uuid
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"不支持的图片格式: {ext}")

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="图片超过10MB限制")

    IMAGE_DIR = "/app/uploads/images"
    os.makedirs(IMAGE_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(IMAGE_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    return {
        "url": f"/api/static/images/{filename}",
        "filename": filename,
        "size": len(content),
        "original_name": file.filename,
    }
