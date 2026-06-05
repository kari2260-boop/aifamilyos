"""add course minimum_plan and ai_practice category

Revision ID: 20260604_0001
Revises: 20260603_0001
Create Date: 2026-06-04

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260604_0001'
down_revision = '20260603_0001'
branch_labels = None
depends_on = None


def upgrade():
    # 1. 给 courses 表添加 minimum_plan 字段（最低要求等级）
    op.add_column('courses', sa.Column('minimum_plan', sa.String(length=20), nullable=True))

    # 2. 设置默认值：is_free=True 的课程改为 free，其他改为 community
    op.execute("UPDATE courses SET minimum_plan = 'free' WHERE is_free = true")
    op.execute("UPDATE courses SET minimum_plan = 'community' WHERE minimum_plan IS NULL")

    # 3. 设置 minimum_plan 为 NOT NULL
    op.alter_column('courses', 'minimum_plan', nullable=False)

    # 4. 给 courses 表添加 category_slugs 数组字段（多分类标签）
    op.add_column('courses', sa.Column('category_slugs', postgresql.ARRAY(sa.String()), nullable=True))
    op.execute("UPDATE courses SET category_slugs = '{}' WHERE category_slugs IS NULL")

    # 5. 插入课程分类（如果不存在）
    op.execute("""
        INSERT INTO course_categories (id, name, slug, sort_order, created_at)
        VALUES
            (gen_random_uuid(), '学习力', 'learning', 10, NOW()),
            (gen_random_uuid(), '创造力', 'project', 20, NOW()),
            (gen_random_uuid(), '天赋', 'talent', 30, NOW()),
            (gen_random_uuid(), '亲子关系', 'parenting', 40, NOW()),
            (gen_random_uuid(), 'AI实操', 'ai-practice', 50, NOW())
        ON CONFLICT (slug) DO NOTHING
    """)


def downgrade():
    op.drop_column('courses', 'minimum_plan')
    op.execute("DELETE FROM course_categories WHERE slug IN ('learning', 'project', 'talent', 'parenting', 'ai-practice')")
