"""
语音转写服务 - 调用阿里云 DashScope SenseVoice
支持微信 H5 录音上传后转文字
"""
import httpx
from app.config import get_settings

settings = get_settings()

TIMEOUT = 30.0


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """
    调用 DashScope 语音识别 API，将音频转成文字

    Args:
        audio_bytes: 音频文件二进制内容
        mime_type: 音频 MIME 类型（webm/mp3/wav 等）

    Returns:
        转写后的文字内容

    Raises:
        Exception: 转写失败时抛出异常
    """
    if not settings.EMBEDDING_API_KEY:
        raise Exception("DashScope API Key 未配置")

    # DashScope 语音识别接口（使用 paraformer-v2 或 sensevoice）
    # 文档：https://help.aliyun.com/zh/dashscope/developer-reference/speech-recognition
    url = "https://dashscope.aliyuncs.com/api/v1/services/audio/asr"

    headers = {
        "Authorization": f"Bearer {settings.EMBEDDING_API_KEY}",
        "X-DashScope-Async": "false",  # 同步模式
    }

    # 根据 mime_type 推断格式
    format_map = {
        "audio/webm": "webm",
        "audio/mp3": "mp3",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/ogg": "ogg",
    }
    audio_format = format_map.get(mime_type, "webm")

    files = {
        "audio": ("audio." + audio_format, audio_bytes, mime_type),
    }

    data = {
        "model": "paraformer-v2",  # 或 sensevoice-v1
        "language": "zh",
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(url, headers=headers, files=files, data=data)
            response.raise_for_status()
            result = response.json()

            # 提取转写文本
            if result.get("output") and result["output"].get("text"):
                return result["output"]["text"]
            else:
                raise Exception(f"转写结果为空: {result}")

    except httpx.HTTPError as e:
        raise Exception(f"语音转写失败: {e}")
