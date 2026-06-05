"""
语音转写服务 - 调用阿里云 DashScope SenseVoice
支持微信 H5 录音上传后转文字

接口文档：
- SenseVoice（推荐，支持 base64 直传）：
  https://help.aliyun.com/zh/model-studio/sensevoice
- Paraformer 录音文件识别（需要公网 URL + 异步轮询）：
  https://help.aliyun.com/zh/model-studio/paraformer-recorded-speech-recognition-restful-api
"""
import base64
import httpx
from app.config import get_settings

settings = get_settings()

TIMEOUT = 60.0


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """
    调用 DashScope SenseVoice 将音频转成文字。
    使用 base64 直传，无需公网 URL，无需异步轮询。

    Args:
        audio_bytes: 音频文件二进制内容
        mime_type: 音频 MIME 类型（webm/mp3/wav/mp4 等）

    Returns:
        转写后的文字内容

    Raises:
        Exception: 转写失败时抛出异常
    """
    api_key = settings.EMBEDDING_API_KEY
    if not api_key:
        raise Exception("DashScope API Key 未配置（EMBEDDING_API_KEY）")

    # 根据 mime_type 推断格式，SenseVoice 支持 pcm/wav/mp3/mp4/m4a/webm/amr 等
    format_map = {
        "audio/webm": "webm",
        "audio/mp3": "mp3",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/ogg": "ogg",
        "audio/mp4": "mp4",
        "audio/m4a": "m4a",
        "audio/amr": "amr",
    }
    audio_format = format_map.get(mime_type, "webm")

    # 转成 base64 data URL
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    audio_data_url = f"data:{mime_type};base64,{audio_b64}"

    # SenseVoice API - 兼容 OpenAI 格式，支持 base64 直传
    url = "https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions"

    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    # multipart/form-data 上传
    # SenseVoice 也支持通过 file_urls 传 base64 data URL
    import io
    files = {
        "file": (f"audio.{audio_format}", io.BytesIO(audio_bytes), mime_type),
        "model": (None, "sensevoice-v1"),
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(url, headers=headers, files=files)

            if response.status_code != 200:
                error_body = response.text
                raise Exception(f"DashScope 返回 {response.status_code}: {error_body}")

            result = response.json()

            # OpenAI 兼容格式：{"text": "..."}
            if result.get("text"):
                return result["text"].strip()

            # 旧格式兜底
            if result.get("output") and result["output"].get("text"):
                return result["output"]["text"].strip()

            raise Exception(f"转写结果为空: {result}")

    except httpx.TimeoutException:
        raise Exception("语音转写超时（60秒），请检查网络或音频时长")
    except httpx.HTTPError as e:
        raise Exception(f"语音转写网络错误: {e}")
