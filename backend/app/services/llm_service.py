"""
LLM Service - 封装大模型API调用
支持 DeepSeek / Qwen 等 OpenAI 兼容格式的 API
"""
import httpx
from typing import List, Dict, Optional, Tuple
from app.config import get_settings

settings = get_settings()

TIMEOUT = 60.0  # 秒


async def chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.3,
    max_tokens: int = 4000,
) -> Tuple[str, int, int, str]:
    """
    调用大模型API生成回复

    Returns:
        (回复内容, input_tokens, output_tokens, 使用的模型名)
    """
    # 先尝试主力模型
    result = await _call_model(
        base_url=settings.MODEL_BASE_URL,
        api_key=settings.MODEL_API_KEY,
        model_name=settings.MODEL_NAME,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    if result is not None:
        return result

    # 主力失败，尝试 fallback
    result = await _call_model(
        base_url=settings.FALLBACK_MODEL_BASE_URL,
        api_key=settings.FALLBACK_MODEL_API_KEY,
        model_name=settings.FALLBACK_MODEL_NAME,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    if result is not None:
        return result

    # 两个都失败
    return ("抱歉，AI 服务暂时不可用，请稍后再试。", 0, 0, "error")


async def _call_model(
    base_url: str,
    api_key: str,
    model_name: str,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> Optional[Tuple[str, int, int, str]]:
    """调用单个模型，失败返回 None"""
    if not api_key:
        return None

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)

            return (content, input_tokens, output_tokens, model_name)

    except (httpx.HTTPError, httpx.TimeoutException, KeyError, IndexError) as e:
        print(f"[LLM Error] {model_name}: {e}")
        return None
