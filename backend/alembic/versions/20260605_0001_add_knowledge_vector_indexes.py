"""add knowledge category and vector indexes

Revision ID: 20260605_0001
Revises: 20260604_0001
Create Date: 2026-06-05
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260605_0001"
down_revision: Union[str, None] = "20260604_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Concurrent index creation keeps production reads and writes available.
    with op.get_context().autocommit_block():
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_knowledge_chunks_category
            ON knowledge_chunks (category)
            """
        )
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_knowledge_chunks_practice_embedding_hnsw
            ON knowledge_chunks
            USING hnsw (embedding vector_cosine_ops)
            WHERE category = 'practice' AND embedding IS NOT NULL
            """
        )
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_knowledge_chunks_global_embedding_hnsw
            ON knowledge_chunks
            USING hnsw (embedding vector_cosine_ops)
            WHERE category = 'global' AND embedding IS NOT NULL
            """
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "DROP INDEX CONCURRENTLY IF EXISTS ix_knowledge_chunks_global_embedding_hnsw"
        )
        op.execute(
            "DROP INDEX CONCURRENTLY IF EXISTS ix_knowledge_chunks_practice_embedding_hnsw"
        )
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_knowledge_chunks_category")
