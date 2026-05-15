"""
Text Splitter - 文本切片工具
将长文本切分为适合 embedding 的片段
"""
from typing import List


def split_text(
    text: str,
    chunk_size: int = 800,
    overlap: int = 120,
) -> List[str]:
    """
    将文本按字符数切片
    chunk_size: 每片最大字符数
    overlap: 相邻片段重叠字符数
    """
    if not text or not text.strip():
        return []

    # 先按段落分割
    paragraphs = text.split("\n")
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # 如果当前段落加上已有内容超过 chunk_size，先保存当前 chunk
        if len(current_chunk) + len(para) + 1 > chunk_size and current_chunk:
            chunks.append(current_chunk.strip())
            # 保留 overlap 部分
            if len(current_chunk) > overlap:
                current_chunk = current_chunk[-overlap:]
            # 不清空，保留重叠

        current_chunk += para + "\n"

        # 如果单个段落就超过 chunk_size，强制切分
        while len(current_chunk) > chunk_size:
            chunks.append(current_chunk[:chunk_size].strip())
            current_chunk = current_chunk[chunk_size - overlap:]

    # 最后一片
    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks
