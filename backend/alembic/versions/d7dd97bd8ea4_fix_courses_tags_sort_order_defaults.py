"""fix_courses_tags_sort_order_defaults

Revision ID: d7dd97bd8ea4
Revises: df54139dc760
Create Date: 2026-05-31 03:55:44.338663+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql



revision: str = 'd7dd97bd8ea4'
down_revision: Union[str, None] = 'df54139dc760'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 回填 courses.tags NULL -> []
    conn.execute(sa.text("UPDATE courses SET tags = '[]'::jsonb WHERE tags IS NULL"))

    # 回填 courses.sort_order NULL -> 0
    conn.execute(sa.text("UPDATE courses SET sort_order = 0 WHERE sort_order IS NULL"))

    # 同样回填 articles.tags（同类问题，防患未然）
    conn.execute(sa.text("UPDATE articles SET tags = '[]'::jsonb WHERE tags IS NULL"))

    # 设置列默认值，避免后续插入时再出现 NULL
    op.alter_column('courses', 'tags',
        server_default=sa.text("'[]'::jsonb"),
        existing_type=postgresql.JSONB(),
        existing_nullable=True,
    )
    op.alter_column('courses', 'sort_order',
        server_default=sa.text('0'),
        existing_type=sa.Integer(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column('courses', 'tags', server_default=None,
        existing_type=postgresql.JSONB(), existing_nullable=True)
    op.alter_column('courses', 'sort_order', server_default=None,
        existing_type=sa.Integer(), existing_nullable=True)
