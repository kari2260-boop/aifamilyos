"""
LLM Service - 封装大模型API调用
支持 DeepSeek / Qwen 等 OpenAI 兼容格式的 API
"""
import httpx
import json
from typing import List, Dict, Optional, Tuple, AsyncGenerator
from app.config import get_settings

settings = get_settings()

TIMEOUT = 60.0  # 秒


async def chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.3,
    max_tokens: int = 4000,
) -> Tuple[str, int, int, str]:
    """
    调用大模型API生成回复（非流式，用于测评报告等场景）

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


async def chat_completion_stream(
    messages: List[Dict[str, str]],
    temperature: float = 0.3,
    max_tokens: int = 4000,
) -> AsyncGenerator[str, None]:
    """
    流式调用大模型API，逐块 yield SSE 数据行
    每行格式：data: {"content": "..."} 或 data: [DONE]
    最后一行：data: {"usage": {...}, "model": "..."}
    """
    # 先尝试主力模型
    success = False
    async for chunk in _call_model_stream(
        base_url=settings.MODEL_BASE_URL,
        api_key=settings.MODEL_API_KEY,
        model_name=settings.MODEL_NAME,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    ):
        success = True
        yield chunk

    if success:
        return

    # 主力失败，尝试 fallback
    async for chunk in _call_model_stream(
        base_url=settings.FALLBACK_MODEL_BASE_URL,
        api_key=settings.FALLBACK_MODEL_API_KEY,
        model_name=settings.FALLBACK_MODEL_NAME,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    ):
        yield chunk


async def _call_model(
    base_url: str,
    api_key: str,
    model_name: str,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> Optional[Tuple[str, int, int, str]]:
    """调用单个模型（非流式），失败返回 None"""
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


async def _call_model_stream(
    base_url: str,
    api_key: str,
    model_name: str,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    """流式调用单个模型，yield SSE 行，失败时不 yield 任何内容"""
    if not api_key:
        return

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
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                response.raise_for_status()
                input_tokens = 0
                output_tokens = 0
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content_piece = delta.get("content", "")
                    if content_piece:
                        output_tokens += 1
                        yield f"data: {json.dumps({'content': content_piece}, ensure_ascii=False)}\n\n"
                    # 部分模型在最后一个chunk里返回usage
                    usage = chunk.get("usage")
                    if usage:
                        input_tokens = usage.get("prompt_tokens", 0)
                        output_tokens = usage.get("completion_tokens", output_tokens)
                # 发送结束标记和用量信息
                yield f"data: {json.dumps({'done': True, 'model': model_name, 'usage': {'input': input_tokens, 'output': output_tokens}}, ensure_ascii=False)}\n\n"

    except (httpx.HTTPError, httpx.TimeoutException) as e:
        print(f"[LLM Stream Error] {model_name}: {e}")
        return
