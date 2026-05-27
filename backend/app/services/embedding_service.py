"""
Embedding Service - 调用 Embedding API 生成向量
支持 OpenAI 兼容格式的 Embedding API（阿里云 DashScope / OpenAI / 其他兼容服务）
当 API Key 未配置时，降级为零向量（文档可上传但暂不支持检索）
"""
import logging
import httpx
from typing import List
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

TIMEOUT = 30.0
FALLBACK_DIMENSION = 1536  # 与数据库 Vector(1536) 保持一致


def _is_key_configured() -> bool:
    """检查 embedding API key 是否已配置（非占位符）"""
    key = settings.EMBEDDING_API_KEY
    return bool(key) and key not in ("your-embedding-api-key", "your-dashscope-api-key", "")


async def get_embedding(text: str) -> List[float]:
    """获取单条文本的 embedding 向量"""
    embeddings = await get_embeddings([text])
    return embeddings[0]


async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """批量获取 embedding 向量"""
    if not _is_key_configured():
        logger.warning("EMBEDDING_API_KEY 未配置，使用零向量降级模式（知识库检索不可用）")
        return [[0.0] * FALLBACK_DIMENSION for _ in texts]

    url = f"{settings.EMBEDDING_BASE_URL}/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.EMBEDDING_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.EMBEDDING_MODEL,
        "input": texts,
        "encoding_format": "float",
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    # OpenAI 格式返回
    embeddings = [item["embedding"] for item in data["data"]]
    return embeddings
