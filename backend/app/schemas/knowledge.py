from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class KnowledgeUploadResponse(BaseModel):
    doc_id: UUID
    title: str
    category: str
    chunks_count: int


class KnowledgeSearchRequest(BaseModel):
    query: str
    category: Optional[str] = None  # learning / project / talent / parenting
    top_k: int = 5


class ChunkResult(BaseModel):
    chunk_id: UUID
    content: str
    category: str
    score: float
    doc_title: str


class KnowledgeSearchResponse(BaseModel):
    results: List[ChunkResult]


class KnowledgeDocItem(BaseModel):
    id: UUID
    title: str
    category: str
    source_type: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
