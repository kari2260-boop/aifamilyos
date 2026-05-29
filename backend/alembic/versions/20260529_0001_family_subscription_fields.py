"""family subscription fields

新增字段：
- subscription_plan: 套餐主字段（权限判断统一看这里）
- subscription_started_at: 开通时间
- subscription_expires_at: 到期时间
- assessment_quota: 剩余测评次数
- report_quota: 剩余报告次数
monthly_quota 改为可空（NULL = 不限）

Revision ID: 20260529_0001
Revises: 20260527_0002
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = '20260529_0001'
down_revision = '20260527_0002'
branch_labels = None
depends_on = None


def upgrade():
    # subscription_plan：套餐主字段
    op.add_column('families', sa.Column('subscription_plan', sa.String(30), nullable=True))
    # subscription_started_at：开通时间
    op.add_column('families', sa.Column('subscription_started_at', sa.DateTime(), nullable=True))
    # subscription_expires_at：到期时间
    op.add_column('families', sa.Column('subscription_expires_at', sa.DateTime(), nullable=True))
    # assessment_quota：剩余测评次数
    op.add_column('families', sa.Column('assessment_quota', sa.Integer(), nullable=True, server_default='0'))
    # report_quota：剩余报告次数
    op.add_column('families', sa.Column('report_quota', sa.Integer(), nullable=True, server_default='0'))
    # monthly_quota 改为可空（NULL = 不限），同时把旧默认值 100 的 free 用户改为 5
    op.alter_column('families', 'monthly_quota', existing_type=sa.Integer(), nullable=True)
    op.execute("UPDATE families SET monthly_quota = 5 WHERE membership_level = 'free' AND monthly_quota = 100")
    # membership_level 字段长度扩展（20→30）
    op.alter_column('families', 'membership_level',
                    existing_type=sa.String(length=20),
                    type_=sa.String(length=30),
                    existing_nullable=True)


def downgrade():
    op.drop_column('families', 'subscription_plan')
    op.drop_column('families', 'subscription_started_at')
    op.drop_column('families', 'subscription_expires_at')
    op.drop_column('families', 'assessment_quota')
    op.drop_column('families', 'report_quota')
    op.alter_column('families', 'monthly_quota', existing_type=sa.Integer(), nullable=False)
    op.alter_column('families', 'membership_level',
                    existing_type=sa.String(length=30),
                    type_=sa.String(length=20),
                    existing_nullable=True)
