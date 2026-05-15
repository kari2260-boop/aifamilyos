"""
Embedding Service - 调用 Embedding API 生成向量
支持 OpenAI 兼容格式的 Embedding API
"""
import httpx
from typing import List
from app.config import get_settings

settings = get_settings()

TIMEOUT = 30.0


async def get_embedding(text: str) -> List[float]:
    """获取单条文本的 embedding 向量"""
    embeddings = await get_embeddings([text])
    return embeddings[0]


async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """批量获取 embedding 向量"""
    if not settings.EMBEDDING_API_KEY:
        raise ValueError("EMBEDDING_API_KEY 未配置")

    url = f"{settings.EMBEDDING_BASE_URL}/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.EMBEDDING_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.EMBEDDING_MODEL,
        "input": texts,
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    # OpenAI 格式返回
    embeddings = [item["embedding"] for item in data["data"]]
    return embeddings
