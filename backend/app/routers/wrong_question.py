"""
错题本 API - 刷刷智能体的错题记录
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from collections import Counter

from app.database import get_db
from app.utils.auth import get_current_user
from app.models.models import User, Family, WrongQuestion, ChildProfile
from app.schemas.wrong_question import (
    WrongQuestionCreate, WrongQuestionUpdate, WrongQuestionItem,
    WrongQuestionDetail, WeaknessSummary
)
from app.services.llm_service import chat_completion

router = APIRouter(prefix="/wrong-questions", tags=["wrong-questions"])


def _get_family(user: User, db: Session) -> Family:
    family = db.query(Family).filter(Family.owner_user_id == user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="未找到家庭档案")
    return family


@router.post("", response_model=WrongQuestionDetail)
async def create_wrong_question(
    req: WrongQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建错题记录（刷刷对话后自动调用）"""
    family = _get_family(current_user, db)

    # 验证 child_id（如果提供）
    if req.child_id:
        child = db.query(ChildProfile).filter(
            ChildProfile.id == req.child_id,
            ChildProfile.family_id == family.id
        ).first()
        if not child:
            raise HTTPException(status_code=404, detail="孩子档案不存在")

    wrong_q = WrongQuestion(
        family_id=family.id,
        child_id=req.child_id,
        conversation_id=req.conversation_id,
        message_id=req.message_id,
        subject=req.subject,
        grade=req.grade,
        question_text=req.question_text,
        image_url=req.image_url,
        knowledge_points=req.knowledge_points,
        mistake_reason=req.mistake_reason,
        ai_explanation=req.ai_explanation,
        similar_questions=req.similar_questions,
        status="new"
    )
    db.add(wrong_q)
    db.commit()
    db.refresh(wrong_q)
    return wrong_q


@router.get("", response_model=List[WrongQuestionItem])
async def list_wrong_questions(
    child_id: Optional[UUID] = None,
    subject: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取错题列表"""
    family = _get_family(current_user, db)

    query = db.query(WrongQuestion).filter(WrongQuestion.family_id == family.id)

    if child_id:
        query = query.filter(WrongQuestion.child_id == child_id)
    if subject:
        query = query.filter(WrongQuestion.subject == subject)
    if status:
        query = query.filter(WrongQuestion.status == status)

    query = query.order_by(WrongQuestion.created_at.desc())
    items = query.offset(offset).limit(limit).all()
    return items


@router.get("/{wrong_question_id}", response_model=WrongQuestionDetail)
async def get_wrong_question(
    wrong_question_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取错题详情"""
    family = _get_family(current_user, db)

    wrong_q = db.query(WrongQuestion).filter(
        WrongQuestion.id == wrong_question_id,
        WrongQuestion.family_id == family.id
    ).first()
    if not wrong_q:
        raise HTTPException(status_code=404, detail="错题记录不存在")

    return wrong_q


@router.put("/{wrong_question_id}", response_model=WrongQuestionDetail)
async def update_wrong_question(
    wrong_question_id: UUID,
    req: WrongQuestionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新错题记录（标记掌握、修改学科等）"""
    family = _get_family(current_user, db)

    wrong_q = db.query(WrongQuestion).filter(
        WrongQuestion.id == wrong_question_id,
        WrongQuestion.family_id == family.id
    ).first()
    if not wrong_q:
        raise HTTPException(status_code=404, detail="错题记录不存在")

    if req.subject is not None:
        wrong_q.subject = req.subject
    if req.grade is not None:
        wrong_q.grade = req.grade
    if req.knowledge_points is not None:
        wrong_q.knowledge_points = req.knowledge_points
    if req.mistake_reason is not None:
        wrong_q.mistake_reason = req.mistake_reason
    if req.status is not None:
        wrong_q.status = req.status

    wrong_q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(wrong_q)
    return wrong_q


@router.delete("/{wrong_question_id}")
async def delete_wrong_question(
    wrong_question_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除错题记录"""
    family = _get_family(current_user, db)

    wrong_q = db.query(WrongQuestion).filter(
        WrongQuestion.id == wrong_question_id,
        WrongQuestion.family_id == family.id
    ).first()
    if not wrong_q:
        raise HTTPException(status_code=404, detail="错题记录不存在")

    db.delete(wrong_q)
    db.commit()
    return {"message": "删除成功"}


@router.post("/summary", response_model=WeaknessSummary)
async def get_weakness_summary(
    child_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """生成薄弱点总结（AI 分析最近错题）"""
    family = _get_family(current_user, db)

    query = db.query(WrongQuestion).filter(WrongQuestion.family_id == family.id)
    if child_id:
        query = query.filter(WrongQuestion.child_id == child_id)

    # 获取最近 50 道错题
    recent_wrongs = query.order_by(WrongQuestion.created_at.desc()).limit(50).all()

    if not recent_wrongs:
        return WeaknessSummary(
            total_count=0,
            subject_distribution={},
            top_weak_points=[],
            suggestions="暂无错题记录，开始和刷刷对话上传题目吧！"
        )

    # 统计学科分布
    subject_counter = Counter([w.subject for w in recent_wrongs if w.subject])
    subject_distribution = dict(subject_counter)

    # 统计知识点频次
    knowledge_counter = Counter()
    for w in recent_wrongs:
        if w.knowledge_points:
            for kp in w.knowledge_points:
                knowledge_counter[kp] += 1

    top_weak_points = [
        {"knowledge_point": kp, "count": cnt}
        for kp, cnt in knowledge_counter.most_common(5)
    ]

    # 调用 LLM 生成改进建议
    prompt = f"""根据孩子最近的错题情况，给出针对性的学习建议：

错题总数：{len(recent_wrongs)}
学科分布：{subject_distribution}
高频错误知识点：{top_weak_points}

请给出 2-3 条简洁实用的改进建议，每条不超过 50 字。"""

    messages = [{"role": "user", "content": prompt}]
    suggestions, _, _, _ = await chat_completion(messages)

    return WeaknessSummary(
        total_count=len(recent_wrongs),
        subject_distribution=subject_distribution,
        top_weak_points=top_weak_points,
        suggestions=suggestions
    )
