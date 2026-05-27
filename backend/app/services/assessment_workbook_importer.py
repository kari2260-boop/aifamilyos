"""
Assessment workbook importer

把学习力测评 Excel 转成系统里的 AssessmentTemplate。

支持的题型：
- 李克特量表题
- 家长测评总表拆分题
- DISC 网格题
- MBTI 1-5 分配题
- 二选一题
"""
from __future__ import annotations

import re
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.models.models import AssessmentTemplate


NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
WBP_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

ZERO_WIDTH = "\u200b\u200c\u200d\ufeff\xa0"


def _clean(text: str | None) -> str:
    if not text:
        return ""
    return (
        str(text)
        .replace("\r", "\n")
        .translate({ord(ch): " " for ch in ZERO_WIDTH})
        .replace("　", " ")
        .strip()
    )


def _col_to_index(col: str) -> int:
    value = 0
    for ch in col:
        value = value * 26 + (ord(ch.upper()) - 64)
    return value


def _ordered_cells(row: dict[str, str]) -> list[tuple[str, str]]:
    return sorted(row.items(), key=lambda item: _col_to_index(item[0]))


def _first_nonempty(row: dict[str, str]) -> str:
    for _, value in _ordered_cells(row):
        if _clean(value):
            return _clean(value)
    return ""


def _extract_ints(text: str) -> list[int]:
    return [int(m.group(1)) for m in re.finditer(r"(?<!\d)(\d+)(?!\d)", text or "")]


def _extract_cell_ints(row: dict[str, str], start_col: str = "B") -> list[int]:
    start = _col_to_index(start_col)
    ints: list[int] = []
    for col, value in _ordered_cells(row):
        if _col_to_index(col) < start:
            continue
        text = _clean(value)
        if not text:
            continue
        matches = _extract_ints(text)
        if matches:
            ints.append(matches[0])
    return ints


def _extract_dimension_code(text: str) -> str | None:
    if not text:
        return None
    candidates = [
        r"（([A-Z])\/([A-Z])维度）",
        r"\(([A-Z])\/([A-Z])维度\)",
        r"（([A-Z])）",
        r"\(([A-Z])\)",
        r"（([A-Z0-9]+)）",
        r"\(([A-Z0-9]+)\)",
    ]
    for pattern in candidates:
        m = re.search(pattern, text)
        if m:
            if len(m.groups()) >= 2:
                return f"{m.group(1)}/{m.group(2)}"
            return m.group(1)
    return None


def _normalize_dimension(text: str | None) -> str:
    text = _clean(text)
    if not text:
        return ""
    text = re.sub(r"^\s*[一二三四五六七八九十\d]+[、\.\s]*", "", text)
    text = re.sub(r"^维度[一二三四五六七八九十\d]+[：:\s]*", "", text)
    text = re.sub(r"[（(]\s*\d+\s*题\s*[)）]$", "", text)
    text = text.replace("（", "(").replace("）", ")")
    return text.strip(" :：-—")


def _strip_question_prefix(text: str) -> str:
    text = _clean(text)
    text = re.sub(r"^\d+[\.、]\s*", "", text)
    text = re.sub(r"^[□\s]*[ABCD]\.\s*", "", text)
    text = re.sub(r"^[□\s]*[ABCD]\s*", "", text)
    return text.strip()


def _extract_choice_text(text: str) -> tuple[str, str | None]:
    text = _clean(text)
    m = re.match(r"^[□\s]*([ABCD])[\.\、]?\s*(.*)$", text)
    if not m:
        return text, None
    choice = m.group(1)
    body = m.group(2).strip()
    dim = None
    dim_match = re.search(r"（([A-Z])）$", body)
    if dim_match:
      dim = dim_match.group(1)
      body = re.sub(r"（([A-Z])）$", "", body).strip()
    return body, dim


def _standard_options_5() -> list[dict[str, Any]]:
    labels = ["完全不符合", "不太符合", "基本符合", "比较符合", "完全符合"]
    return [{"label": label, "value": str(i + 1), "score": i + 1} for i, label in enumerate(labels)]


def _standard_options_4() -> list[dict[str, Any]]:
    labels = ["没有或很少时间", "有时", "相当多时间", "绝大部分时间"]
    return [{"label": label, "value": str(i + 1), "score": i + 1} for i, label in enumerate(labels)]


def _question_from_scale(
    question_text: str,
    labels: list[str],
    scores: list[int],
    dimension: str | None,
    question_type: str = "single",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    options = []
    for idx, score in enumerate(scores):
        label = labels[idx] if idx < len(labels) else str(score)
        option = {
            "label": _clean(label),
            "value": str(score),
            "score": score,
        }
        if dimension:
            option["dimension"] = dimension
        options.append(option)

    question: dict[str, Any] = {
        "question": _strip_question_prefix(question_text),
        "type": question_type,
        "options": options,
    }
    if dimension:
        question["dimension"] = dimension
    if extra:
        question.update(extra)
    return question


class XlsxWorkbookReader:
    def __init__(self, path: str | Path):
        self.path = str(path)
        self._zip = zipfile.ZipFile(self.path)
        self._shared_strings = self._load_shared_strings()
        self._sheet_map = self._load_sheet_map()

    def close(self):
        self._zip.close()

    def _load_shared_strings(self) -> list[str]:
        if "xl/sharedStrings.xml" not in self._zip.namelist():
            return []
        root = ET.fromstring(self._zip.read("xl/sharedStrings.xml"))
        strings: list[str] = []
        for si in root.findall("a:si", NS):
            text = "".join(t.text or "" for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"))
            strings.append(text)
        return strings

    def _load_sheet_map(self) -> dict[str, str]:
        workbook = ET.fromstring(self._zip.read("xl/workbook.xml"))
        rels = ET.fromstring(self._zip.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        sheet_map: dict[str, str] = {}
        for sheet in workbook.find("a:sheets", NS):
            rid = sheet.attrib[f"{{{WBP_NS}}}id"]
            sheet_map[sheet.attrib["name"]] = rel_map[rid]
        return sheet_map

    def sheet_rows(self, sheet_name: str) -> list[dict[str, str]]:
        target = self._sheet_map[sheet_name]
        root = ET.fromstring(self._zip.read(f"xl/{target}"))
        rows: list[dict[str, str]] = []
        for row in root.findall(".//a:sheetData/a:row", NS):
            cells: dict[str, str] = {}
            for cell in row.findall("a:c", NS):
                ref = cell.attrib.get("r", "")
                col = re.match(r"([A-Z]+)", ref)
                if not col:
                    continue
                value = self._cell_text(cell)
                if value:
                    cells[col.group(1)] = value
            rows.append(cells)
        return rows

    def _cell_text(self, cell: ET.Element) -> str:
        cell_type = cell.attrib.get("t")
        v = cell.find("a:v", NS)
        isel = cell.find("a:is", NS)
        if cell_type == "s" and v is not None:
            idx = int(v.text or "0")
            return _clean(self._shared_strings[idx] if idx < len(self._shared_strings) else "")
        if cell_type == "inlineStr" and isel is not None:
            text = "".join(x.text or "" for x in isel.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"))
            return _clean(text)
        if v is not None:
            return _clean(v.text)
        return ""


def _looks_like_header(text: str) -> bool:
    text = _clean(text)
    if not text:
        return False
    return any(
        keyword in text
        for keyword in (
            "维度",
            "指导语",
            "测评说明",
            "理论基础",
            "测评题目",
            "题库",
            "量表设计说明",
            "提示",
            "说明",
            "一、",
            "二、",
            "三、",
            "四、",
            "五、",
            "六、",
            "七、",
            "八、",
            "九、",
            "十、",
        )
    )


def _parse_scale_sheet(rows: list[dict[str, str]], title: str, category: str, sort_order: int) -> dict[str, Any]:
    description_parts: list[str] = []
    questions: list[dict[str, Any]] = []
    current_dimension = ""
    current_labels: list[str] | None = None

    for row in rows:
        first = _first_nonempty(row)
        if not first:
            continue

        if _looks_like_header(first) and not _extract_cell_ints(row):
            if first not in {"题号", "题目"}:
                if any(keyword in first for keyword in ("指导语", "说明", "理论基础", "提示", "量表设计")):
                    description_parts.append(first)
                else:
                    current_dimension = _normalize_dimension(first)
            labels = [v for _, v in _ordered_cells(row)[1:] if _clean(v)]
            if 2 <= len(labels) <= 5 and not any(re.search(r"^\d+$", x) for x in labels):
                current_labels = labels
            continue

        scores = _extract_cell_ints(row)
        if scores and len(scores) >= 2:
            labels = current_labels or [str(s) for s in scores]
            dimension = current_dimension or None
            questions.append(_question_from_scale(first, labels, scores, dimension))
            continue

        # 家长测评总表有“一个单元格里塞了多道题”，这里不直接处理
        if len(_ordered_cells(row)) >= 2:
            description_parts.append(first)

    return {
        "title": title,
        "category": category,
        "description": "\n".join(description_parts[:3]).strip() or None,
        "target_age_min": 8,
        "target_age_max": 18,
        "questions_json": questions,
    }


def _split_numbered_items(text: str) -> list[str]:
    text = _clean(text)
    if not text:
        return []
    parts = re.split(r"(?<!\d)(\d+)[\.、]\s*", text)
    if len(parts) <= 1:
        return [text]
    items: list[str] = []
    for i in range(1, len(parts), 2):
        body = _clean(parts[i + 1] if i + 1 < len(parts) else "")
        if body:
            items.append(body)
    return items


def _parse_parent_summary_sheet(rows: list[dict[str, str]], title: str, category: str, sort_order: int) -> dict[str, Any]:
    questions: list[dict[str, Any]] = []
    description_parts: list[str] = []
    current_main = ""
    current_sub = ""
    labels = ["完全不符合", "不太符合", "基本符合", "比较符合", "完全符合"]
    scores = [1, 2, 3, 4, 5]

    for row in rows:
        values = _ordered_cells(row)
        if not values:
            continue
        first = _clean(values[0][1])
        second = _clean(values[1][1]) if len(values) > 1 else ""
        last = _clean(values[-1][1])

        if first and "家长测评量表" in first:
            description_parts.append(first)
            continue

        if first and not second and not last:
            description_parts.append(first)
            continue

        if first:
            current_main = first
        if second:
            current_sub = second

        if last and re.search(r"\d+[\.、]", last):
            items = _split_numbered_items(last)
            dimension = _normalize_dimension(" / ".join(filter(None, [current_main, current_sub]))) or None
            for item in items:
                question = f"{current_main} / {current_sub} - {item}" if current_sub else f"{current_main} - {item}"
                questions.append(_question_from_scale(question, labels, scores, dimension))

    return {
        "title": title,
        "category": category,
        "description": "\n".join(description_parts[:3]).strip() or None,
        "target_age_min": 8,
        "target_age_max": 18,
        "questions_json": questions,
    }


def _parse_disc_grid_sheet(
    rows: list[dict[str, str]],
    title: str,
    category: str,
    sort_order: int,
) -> dict[str, Any]:
    questions: list[dict[str, Any]] = []
    description_parts: list[str] = []

    i = 0
    while i < len(rows):
        row = rows[i]
        first = _first_nonempty(row)
        if not first:
            i += 1
            continue

        if _looks_like_header(first) and not re.match(r"^\d+[\.、]", first):
            description_parts.append(first)
            i += 1
            continue

        # 4列并行题：题干行 + A/B/C/D 四个选项行
        if re.match(r"^\d+[\.、]", first) and i + 4 < len(rows):
            stem_row = rows[i]
            option_rows = rows[i + 1 : i + 5]
            # 一组题里 4 列并行
            for col in ["A", "B", "C", "D"]:
                stem = _clean(stem_row.get(col, ""))
                if not stem:
                    continue
                options: list[dict[str, Any]] = []
                for opt_idx, opt_row in enumerate(option_rows):
                    opt_text = _clean(opt_row.get(col, ""))
                    if not opt_text:
                        continue
                    label, dim = _extract_choice_text(opt_text)
                    opt_letter = chr(65 + opt_idx)
                    option: dict[str, Any] = {
                        "label": label,
                        "value": opt_letter,
                        "score": 1,
                    }
                    if dim:
                        option["dimension"] = dim
                    options.append(option)
                questions.append({
                    "question": _strip_question_prefix(stem),
                    "type": "single",
                    "dimension": "DISC",
                    "options": options,
                })
            i += 5
            continue

        i += 1

    return {
        "title": title,
        "category": category,
        "description": "\n".join(description_parts[:3]).strip() or None,
        "target_age_min": 8,
        "target_age_max": 18,
        "questions_json": questions,
    }


def _parse_allocation_sheet(
    rows: list[dict[str, str]],
    title: str,
    category: str,
    sort_order: int,
) -> dict[str, Any]:
    questions: list[dict[str, Any]] = []
    description_parts: list[str] = []
    current_pair: tuple[str, str] | None = None

    i = 0
    while i < len(rows):
        row = rows[i]
        first = _first_nonempty(row)
        if not first:
            i += 1
            continue

        if _looks_like_header(first) and not _extract_cell_ints(row):
            description_parts.append(first)
            pair_match = re.search(r"（([A-Z])\/([A-Z])维度）", first)
            if pair_match:
                current_pair = (pair_match.group(1), pair_match.group(2))
            i += 1
            continue

        # 题干行 + 两个选项行
        if _extract_cell_ints(row) and i + 2 < len(rows):
            stem = _strip_question_prefix(first)
            opt_a = _clean(rows[i + 1].get("A", ""))
            opt_b = _clean(rows[i + 2].get("A", ""))
            if opt_a.startswith("A.") and opt_b.startswith("B."):
                left_dim, right_dim = current_pair if current_pair else ("A", "B")
                questions.append({
                    "question": stem,
                    "type": "allocation",
                    "left_dimension": left_dim,
                    "right_dimension": right_dim,
                    "scale_labels": [
                        f"更偏{left_dim}",
                        f"偏{left_dim}",
                        "均衡",
                        f"偏{right_dim}",
                        f"更偏{right_dim}",
                    ],
                    "options": [
                        {
                            "label": _extract_choice_text(opt_a)[0],
                            "value": "A",
                            "dimension": left_dim,
                        },
                        {
                            "label": _extract_choice_text(opt_b)[0],
                            "value": "B",
                            "dimension": right_dim,
                        },
                    ],
                })
                i += 3
                continue

        i += 1

    return {
        "title": title,
        "category": category,
        "description": "\n".join(description_parts[:3]).strip() or None,
        "target_age_min": 8,
        "target_age_max": 18,
        "questions_json": questions,
    }


def _parse_binary_sheet(
    rows: list[dict[str, str]],
    title: str,
    category: str,
    sort_order: int,
) -> dict[str, Any]:
    questions: list[dict[str, Any]] = []
    description_parts: list[str] = []
    current_dimension = ""

    i = 0
    while i < len(rows):
        row = rows[i]
        first = _first_nonempty(row)
        if not first:
            i += 1
            continue

        if _looks_like_header(first):
            description_parts.append(first)
            if "（" in first and "）" in first:
                current_dimension = _normalize_dimension(first)
            i += 1
            continue

        if first and i + 2 < len(rows):
            opt_a = _clean(rows[i + 1].get("A", ""))
            opt_b = _clean(rows[i + 2].get("A", ""))
            if opt_a.startswith("□ A") and opt_b.startswith("□ B"):
                questions.append({
                    "question": _strip_question_prefix(first),
                    "type": "single",
                    "dimension": current_dimension or None,
                    "options": [
                        {
                            "label": _extract_choice_text(opt_a)[0],
                            "value": "A",
                            "score": 1,
                        },
                        {
                            "label": _extract_choice_text(opt_b)[0],
                            "value": "B",
                            "score": 0,
                        },
                    ],
                })
                i += 3
                continue

        i += 1

    return {
        "title": title,
        "category": category,
        "description": "\n".join(description_parts[:3]).strip() or None,
        "target_age_min": 8,
        "target_age_max": 18,
        "questions_json": questions,
    }


def parse_learning_workbook(path: str | Path) -> list[dict[str, Any]]:
    reader = XlsxWorkbookReader(path)
    try:
        templates: list[dict[str, Any]] = []
        sheet_names = list(reader._sheet_map.keys())

        def add_template(sheet_name: str, title: str, category: str, parser, sort_order: int):
            rows = reader.sheet_rows(sheet_name)
            tpl = parser(rows, title, category, sort_order)
            tpl["sort_order"] = sort_order
            tpl["source_sheet"] = sheet_name
            templates.append(tpl)

        mapping = [
            ("A-1认知模型", "A-1 认知模型", "learning_style", _parse_scale_sheet),
            ("A-2记忆力", "A-2 记忆力", "learning_style", _parse_scale_sheet),
            ("A-3个人学习方式", "A-3 个人学习方式", "personality", _parse_scale_sheet),
            ("B-1目标管理", "B-1 目标管理", "learning_system", _parse_scale_sheet),
            ("B-2执行力", "B-2 执行力", "learning_system", _parse_scale_sheet),
            ("B-3专注力", "B-3 专注力", "learning_system", _parse_scale_sheet),
            ("C-1学习意愿", "C-1 学习意愿", "learning_system", _parse_scale_sheet),
            ("C-2内驱力测评", "C-2 内驱力测评", "learning_system", _parse_scale_sheet),
            ("D-1家庭养育环境测评", "D-1 家庭养育环境测评", "learning_system", _parse_scale_sheet),
            ("D-2学校环境测评", "D-2 学校环境测评", "learning_system", _parse_scale_sheet),
            ("D-3社会环境测评", "D-3 社会环境测评", "learning_system", _parse_scale_sheet),
            ("E-家长测评（总表）", "E- 家长测评（总表）", "learning_system", _parse_parent_summary_sheet),
            ("G-1.1DISC测试（学生版）", "G-1.1 DISC 测试（学生版）", "personality", _parse_disc_grid_sheet),
            ("G-1.2DISC测试（成人版）", "G-1.2 DISC 测试（成人版）", "personality", _parse_disc_grid_sheet),
            ("G-2MBTI职业性格测试（学生版）", "G-2 MBTI 职业性格测试（学生版）", "personality", _parse_allocation_sheet),
            ("G-3霍兰德职业兴趣测试（学生版）", "G-3 霍兰德职业兴趣测试（学生版）", "subject_interest", _parse_binary_sheet),
            ("G-4职业锚测试（学生版）", "G-4 职业锚测试（学生版）", "subject_interest", _parse_binary_sheet),
            ("G-5焦虑自评量表", "G-5 焦虑自评量表", "mental_health", _parse_scale_sheet),
            ("G-6抑郁自评量表", "G-6 抑郁自评量表", "mental_health", _parse_scale_sheet),
            ("G-7SCL-90测定", "G-7 SCL-90 测定", "mental_health", _parse_scale_sheet),
        ]

        for idx, (sheet_name, title, category, parser) in enumerate(mapping, start=1):
            if sheet_name not in sheet_names:
                continue
            add_template(sheet_name, title, category, parser, idx)

        return templates
    finally:
        reader.close()


def upsert_templates_from_workbook(db: Session, path: str | Path) -> dict[str, Any]:
    templates = parse_learning_workbook(path)
    created = 0
    updated = 0
    items: list[dict[str, Any]] = []

    for tpl in templates:
        title = tpl["title"]
        category = tpl["category"]
        existing = db.query(AssessmentTemplate).filter(
            AssessmentTemplate.title == title,
            AssessmentTemplate.category == category,
        ).first()

        if existing:
            existing.description = tpl.get("description")
            existing.target_age_min = tpl.get("target_age_min", 8)
            existing.target_age_max = tpl.get("target_age_max", 18)
            existing.questions_json = tpl.get("questions_json", [])
            existing.sort_order = tpl.get("sort_order", 0)
            updated += 1
            template_id = str(existing.id)
        else:
            existing = AssessmentTemplate(
                title=title,
                category=category,
                description=tpl.get("description"),
                target_age_min=tpl.get("target_age_min", 8),
                target_age_max=tpl.get("target_age_max", 18),
                questions_json=tpl.get("questions_json", []),
                sort_order=tpl.get("sort_order", 0),
            )
            db.add(existing)
            db.flush()
            created += 1
            template_id = str(existing.id)

        items.append(
            {
                "id": template_id,
                "title": title,
                "category": category,
                "question_count": len(tpl.get("questions_json", [])),
                "source_sheet": tpl.get("source_sheet"),
            }
        )

    db.commit()
    return {
        "created": created,
        "updated": updated,
        "total": len(templates),
        "templates": items,
    }

