"""baseline current schema

Revision ID: 20260527_0001
Revises: None
Create Date: 2026-05-27
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

from app.database import Base

# Import every model module so Base.metadata includes the full current schema.
from app.models import models as _core_models  # noqa: F401
from app.models import article as _article_models  # noqa: F401
from app.models import course as _course_models  # noqa: F401
from app.models import resource as _resource_models  # noqa: F401


revision: str = "20260527_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    # This baseline is intentionally non-destructive. Do not drop production data.
    pass
