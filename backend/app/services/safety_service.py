"""
Safety Service - 风险识别
检测用户消息中的危险信号（自伤、暴力、霸凌等）
"""
from typing import Optional, Tuple

# 高风险关键词
HIGH_RISK_KEYWORDS = [
    "自杀", "不想活", "想死", "去死", "活着没意思",
    "伤害自己", "割腕", "跳楼", "吃药自杀", "上吊",
    "杀了", "打死", "暴力报复",
]

# 中风险关键词
MEDIUM_RISK_KEYWORDS = [
    "家暴", "霸凌", "被打", "被欺负", "校园暴力",
    "严重抑郁", "不想上学", "离家出走",
    "被性侵", "被猥亵", "被骚扰",
]

# 危机干预提示
CRISIS_RESPONSE = """

---
我注意到你可能正在经历一些困难。请记住，你并不孤单，有人愿意帮助你：

- 全国心理援助热线：400-161-9995
- 生命热线：400-821-1215
- 青少年心理热线：12355

如果你或身边的人正处于危险中，请立即拨打 110 或 120。
"""


def check_risk(message: str) -> Tuple[Optional[str], Optional[str]]:
    """
    检测消息中的风险信号

    Returns:
        (risk_level, risk_type)
        risk_level: None / "medium" / "high"
        risk_type: None / "self_harm" / "violence" / "bullying" / "abuse"
    """
    message_lower = message.lower()

    # 检查高风险
    for keyword in HIGH_RISK_KEYWORDS:
        if keyword in message_lower:
            # 判断类型
            if keyword in ["杀了", "打死", "暴力报复"]:
                return ("high", "violence")
            return ("high", "self_harm")

    # 检查中风险
    for keyword in MEDIUM_RISK_KEYWORDS:
        if keyword in message_lower:
            if keyword in ["家暴", "被打"]:
                return ("medium", "abuse")
            if keyword in ["霸凌", "被欺负", "校园暴力"]:
                return ("medium", "bullying")
            if keyword in ["被性侵", "被猥亵", "被骚扰"]:
                return ("medium", "abuse")
            return ("medium", "self_harm")

    return (None, None)
