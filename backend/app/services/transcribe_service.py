"""
语音转写服务 - 调用阿里云 DashScope Paraformer
支持微信 H5 录音上传后转文字

方案：
1. 把音频以 base64 data URL 形式提交给 Paraformer 录音文件识别接口
2. 接口返回 task_id
3. 轮询 task_id 获取转写结果（通常 3-5 秒）

文档：https://help.aliyun.com/zh/model-studio/paraformer-recorded-speech-recognition-restful-api
"""
import asyncio
import base64
import httpx
from app.config import get_settings

settings = get_settings()

SUBMIT_TIMEOUT = 30.0
POLL_TIMEOUT = 10.0
MAX_POLL_ATTEMPTS = 12  # 最多轮询12次（约60秒）


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """
    调用 DashScope Paraformer 将音频转成文字。
    步骤：提交任务 → 轮询结果

    Args:
        audio_bytes: 音频文件二进制内容
        mime_type: 音频 MIME 类型（webm/mp3/wav/mp4 等）

    Returns:
        转写后的文字内容
    """
    api_key = settings.EMBEDDING_API_KEY
    if not api_key:
        raise Exception("DashScope API Key 未配置（EMBEDDING_API_KEY）")

    # 把音频转成 base64 data URL（Paraformer 支持直接传 data URL，无需公网存储）
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    audio_data_url = f"data:{mime_type};base64,{audio_b64}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",  # 开启异步模式
    }

    # 第1步：提交转写任务
    submit_payload = {
        "model": "paraformer-v2",
        "input": {
            "file_urls": [audio_data_url],
        },
        "parameters": {
            "language_hints": ["zh", "en"],
        }
    }

    async with httpx.AsyncClient(timeout=SUBMIT_TIMEOUT) as client:
        submit_resp = await client.post(
            "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
            headers=headers,
            json=submit_payload,
        )

        if submit_resp.status_code not in (200, 202):
            raise Exception(f"提交转写任务失败 {submit_resp.status_code}: {submit_resp.text}")

        submit_result = submit_resp.json()
        task_id = (
            submit_result.get("output", {}).get("task_id")
            or submit_result.get("task_id")
        )

        if not task_id:
            raise Exception(f"未获取到 task_id: {submit_result}")

    # 第2步：轮询结果
    poll_headers = {
        "Authorization": f"Bearer {api_key}",
    }

    for attempt in range(MAX_POLL_ATTEMPTS):
        await asyncio.sleep(3 if attempt == 0 else 4)  # 首次等3秒，之后每4秒查一次

        async with httpx.AsyncClient(timeout=POLL_TIMEOUT) as client:
            poll_resp = await client.get(
                f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}",
                headers=poll_headers,
            )

            if poll_resp.status_code != 200:
                continue

            poll_result = poll_resp.json()
            task_status = poll_result.get("output", {}).get("task_status", "")

            if task_status == "SUCCEEDED":
                # 提取转写文本
                results = poll_result.get("output", {}).get("results", [])
                if results:
                    transcription = results[0].get("transcription", "")
                    if transcription:
                        # 提取所有句子的文字拼接
                        sentences = transcription.get("sentences", [])
                        if sentences:
                            text = "".join(s.get("text", "") for s in sentences)
                            return text.strip()
                        # 兜底：直接取整段文本
                        text = transcription.get("text", "")
                        if text:
                            return text.strip()
                raise Exception("转写结果为空")

            elif task_status == "FAILED":
                error_msg = poll_result.get("output", {}).get("message", "未知错误")
                raise Exception(f"转写任务失败: {error_msg}")

            # RUNNING / PENDING 继续轮询

    raise Exception("语音转写超时，请重试（音频过长或网络问题）")
