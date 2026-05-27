"""
Prompt Router - Agent 提示词管理接口
仅 admin 可操作
"""
from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.utils.auth import require_admin
from app.models.models import User, AgentPrompt, AgentExample
from app.services.agent_prompts import DEFAULT_PROMPTS

router = APIRouter(prefix="/admin/prompts", tags=["prompts"])


# --- Schemas ---

class ExampleCreate(BaseModel):
    title: str
    user_input: str
    assistant_output: str
    sort_order: int = 0
    is_active: bool = True


class ExampleUpdate(BaseModel):
    title: Optional[str] = None
    user_input: Optional[str] = None
    assistant_output: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    system_prompt: Optional[str] = None
    is_active: Optional[bool] = None


# --- Routes ---

@router.get("")
def list_prompts(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """获取所有 Agent 提示词配置"""
    db_prompts = db.query(AgentPrompt).order_by(AgentPrompt.agent_type).all()

    # 合并DB记录和默认值，确保4个Agent都有
    result = []
    db_map = {p.agent_type: p for p in db_prompts}

    for agent_type, defaults in DEFAULT_PROMPTS.items():
        if agent_type in db_map:
            p = db_map[agent_type]
            examples = db.query(AgentExample).filter(
                AgentExample.agent_prompt_id == p.id
            ).order_by(AgentExample.sort_order).all()
            result.append({
                "id": str(p.id),
                "agent_type": p.agent_type,
                "name": p.name,
                "role": p.role,
                "system_prompt": p.system_prompt,
                "is_active": p.is_active,
                "source": "database",
                "examples": [
                    {
                        "id": str(e.id),
                        "title": e.title,
                        "user_input": e.user_input,
                        "assistant_output": e.assistant_output,
                        "sort_order": e.sort_order,
                        "is_active": e.is_active,
                    }
                    for e in examples
                ],
            })
        else:
            result.append({
                "id": None,
                "agent_type": agent_type,
                "name": defaults["name"],
                "role": defaults["role"],
                "system_prompt": defaults["system_prompt"],
                "is_active": True,
                "source": "default",
                "examples": [],
            })

    return result


@router.put("/{agent_type}")
def update_prompt(
    agent_type: str,
    req: PromptUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新 Agent 提示词（不存在则创建）"""
    if agent_type not in DEFAULT_PROMPTS:
        raise HTTPException(status_code=400, detail=f"无效的 agent_type: {agent_type}")

    prompt = db.query(AgentPrompt).filter(AgentPrompt.agent_type == agent_type).first()

    if not prompt:
        # 从默认值创建
        defaults = DEFAULT_PROMPTS[agent_type]
        prompt = AgentPrompt(
            agent_type=agent_type,
            name=req.name or defaults["name"],
            role=req.role or defaults["role"],
            system_prompt=req.system_prompt or defaults["system_prompt"],
            is_active=req.is_active if req.is_active is not None else True,
        )
        db.add(prompt)
    else:
        if req.name is not None:
            prompt.name = req.name
        if req.role is not None:
            prompt.role = req.role
        if req.system_prompt is not None:
            prompt.system_prompt = req.system_prompt
        if req.is_active is not None:
            prompt.is_active = req.is_active

    db.commit()
    db.refresh(prompt)
    return {"status": "ok", "id": str(prompt.id)}


@router.post("/{agent_type}/examples")
def create_example(
    agent_type: str,
    req: ExampleCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """为 Agent 添加案例"""
    prompt = db.query(AgentPrompt).filter(AgentPrompt.agent_type == agent_type).first()

    if not prompt:
        # 自动从默认值创建 prompt 记录
        defaults = DEFAULT_PROMPTS.get(agent_type)
        if not defaults:
            raise HTTPException(status_code=400, detail=f"无效的 agent_type: {agent_type}")
        prompt = AgentPrompt(
            agent_type=agent_type,
            name=defaults["name"],
            role=defaults["role"],
            system_prompt=defaults["system_prompt"],
        )
        db.add(prompt)
        db.flush()

    example = AgentExample(
        agent_prompt_id=prompt.id,
        title=req.title,
        user_input=req.user_input,
        assistant_output=req.assistant_output,
        sort_order=req.sort_order,
        is_active=req.is_active,
    )
    db.add(example)
    db.commit()
    db.refresh(example)
    return {"status": "ok", "id": str(example.id)}


@router.put("/{agent_type}/examples/{example_id}")
def update_example(
    agent_type: str,
    example_id: UUID,
    req: ExampleUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新案例"""
    example = db.query(AgentExample).filter(AgentExample.id == example_id).first()
    if not example:
        raise HTTPException(status_code=404, detail="案例不存在")

    if req.title is not None:
        example.title = req.title
    if req.user_input is not None:
        example.user_input = req.user_input
    if req.assistant_output is not None:
        example.assistant_output = req.assistant_output
    if req.sort_order is not None:
        example.sort_order = req.sort_order
    if req.is_active is not None:
        example.is_active = req.is_active

    db.commit()
    return {"status": "ok"}


@router.delete("/{agent_type}/examples/{example_id}")
def delete_example(
    agent_type: str,
    example_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除案例"""
    example = db.query(AgentExample).filter(AgentExample.id == example_id).first()
    if not example:
        raise HTTPException(status_code=404, detail="案例不存在")

    db.delete(example)
    db.commit()
    return {"status": "ok"}


@router.post("/{agent_type}/reset")
def reset_prompt(
    agent_type: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """重置为默认提示词"""
    if agent_type not in DEFAULT_PROMPTS:
        raise HTTPException(status_code=400, detail=f"无效的 agent_type: {agent_type}")

    prompt = db.query(AgentPrompt).filter(AgentPrompt.agent_type == agent_type).first()
    if prompt:
        defaults = DEFAULT_PROMPTS[agent_type]
        prompt.name = defaults["name"]
        prompt.role = defaults["role"]
        prompt.system_prompt = defaults["system_prompt"]
        prompt.is_active = True
        db.commit()

    return {"status": "ok"}
