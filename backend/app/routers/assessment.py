"""
Assessment Router - 测评系统
GET  /assessments/templates          获取可用测评列表
GET  /assessments/templates/{id}     获取测评详情（含题目）
POST /assessments/submit             提交答题
GET  /assessments/records            获取我的测评记录
GET  /assessments/reports/{id}       获取测评报告

Admin:
POST /assessments/admin/templates    创建/更新测评模板
GET  /assessments/admin/records      所有测评记录
PUT  /assessments/admin/reports/{id} 审核发布报告
"""
from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.utils.auth import get_current_user, require_admin
from app.models.models import (
    User, Family, ChildProfile,
    AssessmentTemplate, AssessmentRecord, AssessmentReport,
)

router = APIRouter(prefix="/assessments", tags=["assessments"])


# ============ Schemas ============

class TemplateListItem(BaseModel):
    id: UUID
    title: str
    category: str
    description: Optional[str]
    target_age_min: int
    target_age_max: int
    question_count: int

class TemplateDetail(BaseModel):
    id: UUID
    title: str
    category: str
    description: Optional[str]
    target_age_min: int
    target_age_max: int
    questions_json: list

class SubmitRequest(BaseModel):
    template_id: UUID
    child_id: UUID
    filled_by: str = "child"  # child / parent
    answers: list  # [{question_index: 0, selected_value: "A"}]

class RecordItem(BaseModel):
    id: UUID
    template_title: str
    category: str
    child_name: str
    filled_by: str
    status: str
    has_report: bool
    report_status: Optional[str]
    created_at: datetime

class ReportDetail(BaseModel):
    id: UUID
    child_name: str
    template_title: str
    category: str
    scores_json: Optional[dict]
    ai_content_json: Optional[dict]
    consultant_notes: Optional[str]
    final_content_json: Optional[dict]
    status: str
    published_at: Optional[datetime]


# ============ 用户端 API ============

@router.get("/templates")
def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取可用测评列表"""
    templates = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.is_active == True
    ).order_by(AssessmentTemplate.sort_order).all()

    return [
        {
            "id": t.id,
            "title": t.title,
            "category": t.category,
            "description": t.description,
            "target_age_min": t.target_age_min,
            "target_age_max": t.target_age_max,
            "question_count": len(t.questions_json) if t.questions_json else 0,
        }
        for t in templates
    ]


@router.get("/templates/{template_id}")
def get_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取测评详情（含题目）"""
    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == template_id,
        AssessmentTemplate.is_active == True,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="测评不存在")

    return {
        "id": template.id,
        "title": template.title,
        "category": template.category,
        "description": template.description,
        "target_age_min": template.target_age_min,
        "target_age_max": template.target_age_max,
        "questions_json": template.questions_json,
    }


@router.post("/submit")
async def submit_assessment(
    req: SubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交测评答题 → 自动算分 → AI生成初步报告"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    child = db.query(ChildProfile).filter(
        ChildProfile.id == req.child_id,
        ChildProfile.family_id == family.id,
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="孩子不存在")

    template = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.id == req.template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="测评模板不存在")

    # 自动算分
    scores = _calculate_scores(template.questions_json, req.answers)

    # 保存答题记录
    record = AssessmentRecord(
        family_id=family.id,
        child_id=req.child_id,
        template_id=req.template_id,
        filled_by=req.filled_by,
        answers_json=req.answers,
        scores_json=scores,
    )
    db.add(record)
    db.flush()

    # AI生成初步报告
    ai_content = await _generate_ai_report(child, template, req.answers, scores)

    # 创建报告（AI已生成初步内容，待人工审核发布）
    report = AssessmentReport(
        family_id=family.id,
        child_id=req.child_id,
        record_id=record.id,
        ai_content_json=ai_content,
        status="draft",
    )
    db.add(report)
    db.commit()

    return {"status": "ok", "record_id": record.id, "message": "测评已提交，报告将在审核后发布"}


@router.get("/records")
def list_my_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取我的测评记录"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        return []

    records = db.query(AssessmentRecord).filter(
        AssessmentRecord.family_id == family.id
    ).order_by(AssessmentRecord.created_at.desc()).all()

    result = []
    for r in records:
        template = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == r.template_id).first()
        child = db.query(ChildProfile).filter(ChildProfile.id == r.child_id).first()
        report = db.query(AssessmentReport).filter(AssessmentReport.record_id == r.id).first()

        result.append({
            "id": r.id,
            "template_title": template.title if template else "",
            "category": template.category if template else "",
            "child_name": child.name if child else "",
            "filled_by": r.filled_by,
            "status": r.status,
            "has_report": report is not None,
            "report_status": report.status if report else None,
            "report_id": str(report.id) if report else None,
            "created_at": r.created_at,
        })
    return result


@router.get("/reports/{report_id}")
def get_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取测评报告（仅已发布的）"""
    family = db.query(Family).filter(Family.owner_user_id == current_user.id).first()
    if not family:
        raise HTTPException(status_code=404, detail="家庭不存在")

    report = db.query(AssessmentReport).filter(
        AssessmentReport.id == report_id,
        AssessmentReport.family_id == family.id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    if report.status != "published":
        return {"status": report.status, "message": "报告正在审核中，请稍后查看"}

    record = db.query(AssessmentRecord).filter(AssessmentRecord.id == report.record_id).first()
    template = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == record.template_id).first() if record else None
    child = db.query(ChildProfile).filter(ChildProfile.id == report.child_id).first()

    return {
        "id": report.id,
        "child_name": child.name if child else "",
        "template_title": template.title if template else "",
        "category": template.category if template else "",
        "scores_json": record.scores_json if record else None,
        "final_content_json": report.final_content_json,
        "consultant_notes": report.consultant_notes,
        "status": report.status,
        "published_at": report.published_at,
    }


# ============ 管理后台 API ============

class TemplateCreateRequest(BaseModel):
    title: str
    category: str
    description: Optional[str] = None
    target_age_min: int = 8
    target_age_max: int = 18
    questions_json: list
    sort_order: int = 0

class ReportReviewRequest(BaseModel):
    consultant_notes: Optional[str] = None
    final_content_json: Optional[dict] = None
    action: str  # "publish" / "save_draft"


@router.post("/admin/templates")
def create_template(
    req: TemplateCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """创建测评模板"""
    template = AssessmentTemplate(
        title=req.title,
        category=req.category,
        description=req.description,
        target_age_min=req.target_age_min,
        target_age_max=req.target_age_max,
        questions_json=req.questions_json,
        sort_order=req.sort_order,
    )
    db.add(template)
    db.commit()
    return {"status": "ok", "id": template.id}


@router.put("/admin/templates/{template_id}")
def update_template(
    template_id: UUID,
    req: TemplateCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新测评模板"""
    template = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    template.title = req.title
    template.category = req.category
    template.description = req.description
    template.target_age_min = req.target_age_min
    template.target_age_max = req.target_age_max
    template.questions_json = req.questions_json
    template.sort_order = req.sort_order
    db.commit()
    return {"status": "ok"}


@router.get("/admin/records")
def admin_list_records(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员查看所有测评记录"""
    records = db.query(AssessmentRecord).order_by(AssessmentRecord.created_at.desc()).limit(100).all()

    result = []
    for r in records:
        template = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == r.template_id).first()
        child = db.query(ChildProfile).filter(ChildProfile.id == r.child_id).first()
        family = db.query(Family).filter(Family.id == r.family_id).first()
        report = db.query(AssessmentReport).filter(AssessmentReport.record_id == r.id).first()

        result.append({
            "id": r.id,
            "family_name": family.family_name if family else "",
            "child_name": child.name if child else "",
            "template_title": template.title if template else "",
            "category": template.category if template else "",
            "filled_by": r.filled_by,
            "report_status": report.status if report else "no_report",
            "report_id": str(report.id) if report else None,
            "created_at": r.created_at,
        })
    return result


@router.put("/admin/reports/{report_id}")
def review_report(
    report_id: UUID,
    req: ReportReviewRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """审核/发布测评报告"""
    report = db.query(AssessmentReport).filter(AssessmentReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    if req.consultant_notes is not None:
        report.consultant_notes = req.consultant_notes
    if req.final_content_json is not None:
        report.final_content_json = req.final_content_json

    if req.action == "publish":
        report.status = "published"
        report.reviewed_by = current_user.id
        report.published_at = datetime.utcnow()
    elif req.action == "save_draft":
        report.status = "reviewed"

    db.commit()
    return {"status": "ok", "report_status": report.status}


# ============ 辅助函数 ============

def _calculate_scores(questions_json: list, answers: list) -> dict:
    """根据答题计算各维度得分"""
    # 按选项值统计频率
    value_counts: dict = {}
    for ans in answers:
        val = ans.get("selected_value", "")
        value_counts[val] = value_counts.get(val, 0) + 1

    total = len(answers)
    return {
        "total_questions": total,
        "answered": len(answers),
        "value_distribution": value_counts,
        "completion_rate": round(len(answers) / max(len(questions_json), 1) * 100, 1),
    }


async def _generate_ai_report(child, template, answers: list, scores: dict) -> dict:
    """用AI生成测评初步报告"""
    try:
        from app.services.llm_service import chat_completion

        # 构建答题摘要
        answer_summary = ""
        for ans in answers[:20]:
            q_idx = ans.get("question_index", 0)
            if q_idx < len(template.questions_json):
                q = template.questions_json[q_idx]
                selected = ans.get("selected_value", "")
                # 找到选项文本
                option_text = selected
                for opt in q.get("options", []):
                    if opt.get("value") == selected:
                        option_text = opt.get("label", selected)
                        break
                answer_summary += f"Q: {q.get('question', '')} → {option_text}\n"

        prompt = f"""你是一位儿童发展评估专家。请根据以下测评结果，生成一份简要的评估报告。

孩子信息：{child.name}，{child.age or '未知'}岁，{child.grade or '未知'}年级
测评类型：{template.title}（{template.category}）

答题结果：
{answer_summary}

请以JSON格式返回评估报告：
{{
  "summary": "一句话总结（20字以内）",
  "strengths": ["优势1", "优势2"],
  "areas_to_develop": ["待发展方向1", "待发展方向2"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "overall_score": "A/B/C/D 等级"
}}

只返回JSON。"""

        messages = [{"role": "user", "content": prompt}]
        reply, _, _, _ = await chat_completion(messages, temperature=0.3, max_tokens=1500)

        import json
        json_str = reply
        if "```" in reply:
            json_str = reply.split("```")[1].strip()
            if json_str.startswith("json"):
                json_str = json_str[4:].strip()
        return json.loads(json_str)

    except Exception:
        return {
            "summary": "测评已完成，待咨询师审核",
            "strengths": [],
            "areas_to_develop": [],
            "suggestions": [],
            "overall_score": "待评估",
        }
