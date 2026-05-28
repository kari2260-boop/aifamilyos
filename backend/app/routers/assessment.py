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
import json
import tempfile
from pathlib import Path
from uuid import UUID
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.utils.auth import get_current_user, require_admin
from app.models.models import (
    User, Family, ChildProfile,
    AssessmentTemplate, AssessmentRecord, AssessmentReport,
)
from app.services.assessment_workbook_importer import build_assessment_workbook_preview, upsert_templates_from_workbook

router = APIRouter(prefix="/assessments", tags=["assessments"])
ALLOWED_ASSESSMENT_CATEGORIES = {"learning", "creativity", "talent", "parent_child"}
CATEGORY_LABELS = {
    "learning": "学习力",
    "creativity": "创造力和综合能力",
    "talent": "个人天赋",
    "parent_child": "亲子关系",
}


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
    content_json: Optional[dict]
    status: str
    published_at: Optional[datetime]


class WorkbookSectionPreview(BaseModel):
    sheet_name: str
    question_count: int
    sample_questions: list[str]


class WorkbookPreviewResponse(BaseModel):
    bucket: str
    bucket_label: str
    title: str
    category: str
    description: Optional[str]
    question_count: int
    sheet_count: int
    included_sheets: list[str]
    excluded_sheets: list[str]
    sections: list[WorkbookSectionPreview]


class WorkbookImportResponse(BaseModel):
    created: int
    updated: int
    total: int
    bucket: str
    templates: list
    sections: list[WorkbookSectionPreview]
    included_sheets: list[str]
    excluded_sheets: list[str]
    question_count: int


# ============ 用户端 API ============

@router.get("/templates")
def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取可用测评列表"""
    templates = db.query(AssessmentTemplate).filter(
        AssessmentTemplate.is_active == True,
        AssessmentTemplate.category.in_(ALLOWED_ASSESSMENT_CATEGORIES),
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
    if template.category not in ALLOWED_ASSESSMENT_CATEGORIES:
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

    # 自动刷新成长画像标签，便于后续在后台看到测评带来的画像更新
    try:
        from app.services.tag_service import analyze_child_tags

        await analyze_child_tags(str(child.id), db)
    except Exception:
        pass

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
    content_json = report.final_content_json or report.ai_content_json

    return {
        "id": report.id,
        "child_name": child.name if child else "",
        "template_title": template.title if template else "",
        "category": template.category if template else "",
        "scores_json": record.scores_json if record else None,
        "ai_content_json": report.ai_content_json,
        "final_content_json": report.final_content_json,
        "content_json": content_json,
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


@router.post("/admin/templates/preview-xlsx", response_model=WorkbookPreviewResponse)
async def preview_templates_from_xlsx(
    file: UploadFile = File(...),
    bucket: str = Form("learning"),
    current_user: User = Depends(require_admin),
):
    """预览 Excel 导入结果，不写库"""
    filename = (file.filename or "").lower()
    if not filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 文件")
    if bucket not in ALLOWED_ASSESSMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail="请选择正确的测评类别")

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name
        content = await file.read()
        tmp.write(content)

    try:
        preview = build_assessment_workbook_preview(tmp_path, bucket)
        return WorkbookPreviewResponse(
            bucket=preview["bucket"],
            bucket_label=CATEGORY_LABELS.get(preview["bucket"], preview["bucket"]),
            title=preview["title"],
            category=preview["category"],
            description=preview.get("description"),
            question_count=preview.get("question_count", 0),
            sheet_count=preview.get("sheet_count", 0),
            included_sheets=preview.get("included_sheets", []),
            excluded_sheets=preview.get("excluded_sheets", []),
            sections=[WorkbookSectionPreview(**item) for item in preview.get("sections", [])],
        )
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


@router.post("/admin/templates/import-xlsx", response_model=WorkbookImportResponse)
async def import_templates_from_xlsx(
    file: UploadFile = File(...),
    bucket: str = Form("learning"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """上传测评 Excel，自动生成一个可发布的测评模板"""
    filename = (file.filename or "").lower()
    if not filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 文件")
    if bucket not in ALLOWED_ASSESSMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail="请选择正确的测评类别")

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name
        content = await file.read()
        tmp.write(content)

    try:
        result = upsert_templates_from_workbook(db, tmp_path, bucket=bucket)
        return WorkbookImportResponse(
            created=result["created"],
            updated=result["updated"],
            total=result["total"],
            bucket=result["bucket"],
            templates=result["templates"],
            sections=[WorkbookSectionPreview(**item) for item in result.get("sections", [])],
            included_sheets=result.get("included_sheets", []),
            excluded_sheets=result.get("excluded_sheets", []),
            question_count=result.get("question_count", 0),
        )
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


@router.post("/admin/templates")
def create_template(
    req: TemplateCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """创建测评模板"""
    if req.category not in ALLOWED_ASSESSMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail="分类仅支持学习力、创造力和综合能力、个人天赋、亲子关系")

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

    if req.category not in ALLOWED_ASSESSMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail="分类仅支持学习力、创造力和综合能力、个人天赋、亲子关系")

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


@router.get("/admin/reports/{report_id}")
def admin_get_report(
    report_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员查看测评报告详情（含草稿与最终稿）"""
    report = db.query(AssessmentReport).filter(AssessmentReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    record = db.query(AssessmentRecord).filter(AssessmentRecord.id == report.record_id).first()
    template = db.query(AssessmentTemplate).filter(AssessmentTemplate.id == record.template_id).first() if record else None
    child = db.query(ChildProfile).filter(ChildProfile.id == report.child_id).first()
    family = db.query(Family).filter(Family.id == report.family_id).first()
    content_json = report.final_content_json or report.ai_content_json

    return {
        "id": report.id,
        "family_name": family.family_name if family else "",
        "child_name": child.name if child else "",
        "child_summary": {
            "name": child.name if child else "",
            "age": child.age if child else None,
            "grade": child.grade if child else None,
        },
        "template_title": template.title if template else "",
        "category": template.category if template else "",
        "scores_json": record.scores_json if record else None,
        "answers_json": record.answers_json if record else None,
        "ai_content_json": report.ai_content_json,
        "final_content_json": report.final_content_json,
        "content_json": content_json,
        "consultant_notes": report.consultant_notes,
        "status": report.status,
        "published_at": report.published_at,
    }


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
        if req.final_content_json is None and report.ai_content_json is not None:
            report.final_content_json = report.ai_content_json
        report.status = "published"
        report.reviewed_by = current_user.id
        report.published_at = datetime.utcnow()
    elif req.action == "save_draft":
        report.status = "reviewed"

    db.commit()
    return {"status": "ok", "report_status": report.status}


# ============ 辅助函数 ============

def _extract_question_scoring(question: dict) -> dict:
    options = question.get("options", []) or []
    scoring: dict[str, Any] = {
        "type": question.get("type", "single"),
        "dimension": question.get("dimension"),
    }
    if question.get("type") == "allocation":
        scoring["left_dimension"] = question.get("left_dimension")
        scoring["right_dimension"] = question.get("right_dimension")
    option_map = {}
    for opt in options:
        option_map[str(opt.get("value", ""))] = opt
    scoring["option_map"] = option_map
    return scoring


def _calculate_scores(questions_json: list, answers: list) -> dict:
    """根据答题计算总分、维度分、选项分布"""
    value_counts: dict[str, int] = {}
    dimension_details: dict[str, dict[str, Any]] = {}

    for ans in answers:
        val = str(ans.get("selected_value", ""))
        value_counts[val] = value_counts.get(val, 0) + 1

        q_idx = ans.get("question_index", -1)
        if q_idx < 0 or q_idx >= len(questions_json):
            continue

        question = questions_json[q_idx] or {}
        scoring = _extract_question_scoring(question)
        option = scoring["option_map"].get(val, {})
        question_type = scoring["type"]

        if question_type == "allocation":
            try:
                scale_value = max(1, min(5, int(val)))
            except Exception:
                scale_value = 3
            left_points = 6 - scale_value
            right_points = scale_value - 1
            left_dim = scoring.get("left_dimension")
            right_dim = scoring.get("right_dimension")
            if left_dim:
                detail = dimension_details.setdefault(left_dim, {"total": 0.0, "count": 0, "average": 0.0})
                detail["total"] += left_points
                detail["count"] += 1
            if right_dim:
                detail = dimension_details.setdefault(right_dim, {"total": 0.0, "count": 0, "average": 0.0})
                detail["total"] += right_points
                detail["count"] += 1
            continue

        dim = option.get("dimension") or scoring.get("dimension")
        score = option.get("score")
        if score is None:
            try:
                score = int(val)
            except Exception:
                score = 1 if val else 0

        if dim:
            detail = dimension_details.setdefault(dim, {"total": 0.0, "count": 0, "average": 0.0})
            detail["total"] += float(score)
            detail["count"] += 1

    dimension_scores: dict[str, dict[str, Any]] = {}
    for dim, detail in dimension_details.items():
        count = detail["count"] or 1
        average = round(detail["total"] / count, 2)
        dimension_scores[dim] = {
            "total": round(detail["total"], 2),
            "count": count,
            "average": average,
        }

    total_questions = len(questions_json)
    answered = len(answers)
    return {
        "total_questions": total_questions,
        "answered": answered,
        "value_distribution": value_counts,
        "dimension_scores": dimension_scores,
        "completion_rate": round(answered / max(total_questions, 1) * 100, 1),
    }


def _build_score_summary(scores: dict) -> dict:
    dimension_scores = scores.get("dimension_scores", {}) or {}
    ranked = sorted(
        dimension_scores.items(),
        key=lambda item: (item[1].get("average", 0), item[1].get("total", 0)),
        reverse=True,
    )
    top_dimensions = [
        {"dimension": dim, **detail}
        for dim, detail in ranked[:3]
    ]
    lowest_dimensions = [
        {"dimension": dim, **detail}
        for dim, detail in sorted(
            dimension_scores.items(),
            key=lambda item: (item[1].get("average", 0), item[1].get("total", 0)),
        )[:3]
    ]
    return {
        "completion_rate": scores.get("completion_rate", 0),
        "total_questions": scores.get("total_questions", 0),
        "answered": scores.get("answered", 0),
        "value_distribution": scores.get("value_distribution", {}),
        "dimension_scores": dimension_scores,
        "top_dimensions": top_dimensions,
        "lowest_dimensions": lowest_dimensions,
    }


LEARNING_MODULES = [
    ("learning_advantage", "学习优势", ["认知模型", "记忆力", "个人学习方式"]),
    ("creative_action", "创行力", ["目标管理", "执行力", "专注力"]),
    ("inner_motivation", "心动力", ["学习意愿", "内驱力"]),
    ("ecology_support", "生态承载力", ["家庭环境", "学校环境", "社会环境"]),
]


def _score_level(avg: float) -> str:
    if avg >= 4.2:
        return "优势明显"
    if avg >= 3.4:
        return "稳步成长"
    if avg >= 2.8:
        return "正在积累"
    return "需要更多支持"


def _avg_to_100(avg: float) -> int:
    return int(round(max(0.0, min(5.0, avg)) * 20))


def _build_learning_report_payload(child, template, scores: dict, answers: list) -> dict:
    dimension_scores = scores.get("dimension_scores", {}) or {}
    module_reports = []
    module_totals: list[float] = []

    for key, label, dimensions in LEARNING_MODULES:
        parts = []
        total = 0.0
        count = 0
        for dim in dimensions:
            detail = dimension_scores.get(dim)
            if not detail:
                continue
            parts.append((dim, detail))
            total += float(detail.get("total", 0))
            count += int(detail.get("count", 0) or 0)

        if count:
            avg = total / count
            module_totals.append(avg)
            ranked_dims = sorted(parts, key=lambda item: (item[1].get("average", 0), item[1].get("total", 0)), reverse=True)
            weakest = sorted(parts, key=lambda item: (item[1].get("average", 0), item[1].get("total", 0)))
            module_reports.append({
                "key": key,
                "name": label,
                "score": _avg_to_100(avg),
                "average": round(avg, 2),
                "level": _score_level(avg),
                "highlights": [f"{dim}较强" for dim, _ in ranked_dims[:2]],
                "risks": [f"{dim}可以优先练习" for dim, _ in weakest[:1]],
                "suggestions": [
                    f"优先提升{weakest[0][0]}相关练习" if weakest else f"保持{label}现有优势",
                    f"把{label}的改善动作拆成7天可执行小步",
                ],
            })

    overall_avg = sum(module_totals) / len(module_totals) if module_totals else 0.0
    dimension_ranked = sorted(dimension_scores.items(), key=lambda item: (item[1].get("average", 0), item[1].get("total", 0)), reverse=True)
    dimension_low = sorted(dimension_scores.items(), key=lambda item: (item[1].get("average", 0), item[1].get("total", 0)))

    tag_map = {
        "认知模型": "认知基础较强",
        "记忆力": "记忆保持较稳",
        "个人学习方式": "学习方式清晰",
        "目标管理": "目标感可继续强化",
        "执行力": "执行推进型",
        "专注力": "注意力分配可优化",
        "学习意愿": "学习意愿较高",
        "内驱力": "内驱动力可继续激活",
        "家庭环境": "家庭支持可提升",
        "学校环境": "学校支持适配度待观察",
        "社会环境": "外部干扰需管理",
    }
    tags = []
    for dim, detail in dimension_ranked[:4]:
        if detail.get("average", 0) >= 3.8:
            tags.append(tag_map.get(dim, f"{dim}较强"))
    for dim, detail in dimension_low[:2]:
        if detail.get("average", 0) < 3.2:
            tags.append(tag_map.get(dim, f"{dim}需支持"))
    if not tags:
        tags = ["学习状态可继续优化"]

    strengths = [f"{dim}表现较强" for dim, detail in dimension_ranked[:3] if detail.get("average", 0) >= 3.6]
    areas = [f"{dim}是当前优先练习点" for dim, detail in dimension_low[:3] if detail.get("average", 0) < 3.6]
    suggestions = []
    for dim, detail in dimension_low[:3]:
        if detail.get("average", 0) < 3.6:
            suggestions.append(f"先用{dim}相关的短周期练习做启动")
    if not suggestions:
        suggestions.append("保持优势维度，同时每周复盘一次变化")

    overall_level = _score_level(overall_avg)
    if overall_avg >= 4.2:
        summary = "学习力结构较强，适合继续拓展高阶任务。"
    elif overall_avg >= 3.4:
        summary = "学习力整体稳定，当前重点是巩固优势并继续成长。"
    else:
        summary = "学习力基础正在建立，建议先从最需要支持的环节开始。"

    return {
        "report_type": "learning_short_v1",
        "summary": summary,
        "overall_score": _avg_to_100(overall_avg),
        "overall_average": round(overall_avg, 2),
        "overall_level": overall_level,
        "profile_tags": tags,
        "module_reports": module_reports,
        "dimension_scores": dimension_scores,
        "strengths": strengths,
        "areas_to_develop": areas,
        "suggestions": suggestions,
        "next_steps": {
            "student": ["先从一个最弱维度开始改进", "连续7天记录一次学习状态"],
            "parent": ["不要同时加太多要求", "先给孩子提供稳定支持和反馈"],
            "30_days": ["观察一个月内四大模块的变化", "必要时进入深度版分项测评"],
        },
        "child_summary": {
            "name": getattr(child, "name", ""),
            "age": getattr(child, "age", None),
            "grade": getattr(child, "grade", None),
        },
        "answer_count": len(answers),
    }


async def _generate_ai_report(child, template, answers: list, scores: dict) -> dict:
    """用AI生成测评初步报告"""
    score_summary = _build_score_summary(scores)
    if template.category == "learning":
        base_report = _build_learning_report_payload(child, template, scores, answers)
    else:
        base_report = {
            "report_type": "generic_short_v1",
            "summary": "测评已完成，待咨询师审核。",
            "overall_score": "待评估",
            "strengths": [],
            "areas_to_develop": [],
            "suggestions": [],
        }

    try:
        from app.services.llm_service import chat_completion

        answer_summary = ""
        for ans in answers[:20]:
            q_idx = ans.get("question_index", 0)
            if q_idx < len(template.questions_json):
                q = template.questions_json[q_idx]
                selected = ans.get("selected_value", "")
                option_text = selected
                for opt in q.get("options", []):
                    if opt.get("value") == selected:
                        option_text = opt.get("label", selected)
                        break
                answer_summary += f"Q: {q.get('question', '')} → {option_text}\n"

        if template.category == "learning":
            prompt = f"""你是一位儿童学习力评估专家。请基于下面的结构化评分结果，输出一份严格符合JSON格式的学习力报告。

孩子信息：{child.name}，{child.age or '未知'}岁，{child.grade or '未知'}年级
测评类型：{template.title}（{template.category}）

评分摘要：
{json.dumps(score_summary, ensure_ascii=False, indent=2)}

题目作答摘要：
{answer_summary}

必须输出以下JSON结构，不要输出多余文本：
{{
  "report_type": "learning_short_v1",
  "summary": "一句话总评",
  "overall_score": 0,
  "overall_average": 0,
  "overall_level": "优势明显 / 稳步成长 / 正在积累 / 需要更多支持",
  "profile_tags": ["标签1", "标签2"],
  "module_reports": [
    {{
      "key": "learning_advantage",
      "name": "学习优势",
      "score": 0,
      "average": 0,
      "level": "",
      "highlights": ["亮点"],
      "risks": ["风险"],
      "suggestions": ["建议"]
    }}
  ],
  "strengths": ["优势1"],
  "areas_to_develop": ["优先练习点1"],
  "suggestions": ["建议1", "建议2"],
  "next_steps": {{
    "student": ["学生建议"],
    "parent": ["家长建议"],
    "30_days": ["30天建议"]
  }},
  "child_summary": {{
    "name": "{child.name}",
    "age": {child.age if child.age is not None else 'null'},
    "grade": {json.dumps(child.grade) if child.grade is not None else 'null'}
  }},
  "answer_count": {len(answers)}
}}

只返回JSON。"""
            messages = [{"role": "user", "content": prompt}]
            reply, _, _, _ = await chat_completion(messages, temperature=0.25, max_tokens=1800)
            json_str = reply
            if "```" in reply:
                json_str = reply.split("```")[1].strip()
                if json_str.startswith("json"):
                    json_str = json_str[4:].strip()
            parsed = json.loads(json_str)
            if isinstance(parsed, dict):
                return parsed
    except Exception:
        pass

    return base_report
