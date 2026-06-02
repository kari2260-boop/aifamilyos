"""
Vision Service - 图片理解
调用支持视觉的 OpenAI-compatible 模型，把图片转成可靠文字摘要。
"""
import base64
import mimetypes
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.config import get_settings

settings = get_settings()

TIMEOUT = 45.0
UPLOAD_IMAGE_DIR = Path("/app/uploads/images")


def _image_path_from_url(url: str) -> Path | None:
    parsed = urlparse(url)
    path = parsed.path if parsed.scheme else url
    prefix = "/api/static/images/"
    if not path.startswith(prefix):
        return None
    filename = Path(path[len(prefix):]).name
    if not filename:
        return None
    return UPLOAD_IMAGE_DIR / filename


def _data_url_from_path(path: Path) -> str:
    mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{data}"


async def describe_image(image_url: str, image_name: str | None = None) -> str:
    """
    返回图片内容摘要。优先读取本地 uploads 文件转 data URL，避免模型访问不到内网/localhost URL。
    """
    api_key = (
        settings.VISION_MODEL_API_KEY
        or settings.FALLBACK_MODEL_API_KEY
        or settings.EMBEDDING_API_KEY
    )
    if not api_key:
        return "图片已上传，但视觉模型 API Key 未配置，暂时无法识别图片内容。"

    model_url = f"{settings.VISION_MODEL_BASE_URL}/chat/completions"
    image_content_url = image_url
    local_path = _image_path_from_url(image_url)
    if local_path and local_path.exists():
        image_content_url = _data_url_from_path(local_path)

    name_hint = f"文件名：{image_name}\n" if image_name else ""
    prompt = (
        "请客观识别这张图片，输出给后续家庭教育 AI 使用的结构化摘要。\n"
        f"{name_hint}"
        "请包含：1. 画面主要内容；2. 如果有文字，请尽量 OCR 摘录；"
        "3. 与孩子学习/作品/情绪/家庭沟通相关的可观察线索；"
        "4. 不确定的地方明确说不确定。不要编造图片中不存在的信息。"
    )
    payload = {
        "model": settings.VISION_MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_content_url}},
                ],
            }
        ],
        "temperature": 0.1,
        "max_tokens": 800,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(model_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[Vision Error] {settings.VISION_MODEL_NAME}: {e}")
        return "图片已上传，但视觉模型识别失败；请用户补充描述图片内容。"
