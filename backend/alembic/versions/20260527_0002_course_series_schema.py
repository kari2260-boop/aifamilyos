"""ensure course series schema

Revision ID: 20260527_0002
Revises: 20260527_0001
Create Date: 2026-05-27
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260527_0002"
down_revision: Union[str, None] = "20260527_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS course_series (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(200) NOT NULL,
            description TEXT,
            cover_url VARCHAR(500),
            sort_order INTEGER DEFAULT 0,
            is_published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS course_modules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            series_id UUID NOT NULL REFERENCES course_series(id),
            title VARCHAR(200) NOT NULL,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """
    )
    op.execute("ALTER TABLE course_series ALTER COLUMN id SET DEFAULT gen_random_uuid()")
    op.execute("ALTER TABLE course_modules ALTER COLUMN id SET DEFAULT gen_random_uuid()")
    op.execute("ALTER TABLE courses ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES course_series(id)")
    op.execute("ALTER TABLE courses ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES course_modules(id)")
    op.execute("ALTER TABLE courses ADD COLUMN IF NOT EXISTS lesson_order INTEGER DEFAULT 0")
    op.execute("ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_minutes INTEGER")
    op.execute("CREATE INDEX IF NOT EXISTS ix_courses_series_id ON courses(series_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_courses_module_id ON courses(module_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_course_modules_series_id ON course_modules(series_id)")


def downgrade() -> None:
    # Keep this migration non-destructive for production data safety.
    pass
