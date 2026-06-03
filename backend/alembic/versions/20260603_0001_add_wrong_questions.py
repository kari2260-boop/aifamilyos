"""add wrong_questions table

Revision ID: 20260603_0001
Revises: df54139dc760
Create Date: 2026-06-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260603_0001'
down_revision = 'df54139dc760'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'wrong_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('child_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('subject', sa.String(length=50), nullable=True),
        sa.Column('grade', sa.String(length=20), nullable=True),
        sa.Column('question_text', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('knowledge_points', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('mistake_reason', sa.Text(), nullable=True),
        sa.Column('ai_explanation', sa.Text(), nullable=True),
        sa.Column('similar_questions', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_wrong_questions_family_id'), 'wrong_questions', ['family_id'], unique=False)
    op.create_index(op.f('ix_wrong_questions_child_id'), 'wrong_questions', ['child_id'], unique=False)
    op.create_index(op.f('ix_wrong_questions_conversation_id'), 'wrong_questions', ['conversation_id'], unique=False)
    op.create_foreign_key('wrong_questions_family_id_fkey', 'wrong_questions', 'families', ['family_id'], ['id'])
    op.create_foreign_key('wrong_questions_child_id_fkey', 'wrong_questions', 'children_profiles', ['child_id'], ['id'])
    op.create_foreign_key('wrong_questions_conversation_id_fkey', 'wrong_questions', 'conversations', ['conversation_id'], ['id'])
    op.create_foreign_key('wrong_questions_message_id_fkey', 'wrong_questions', 'messages', ['message_id'], ['id'])


def downgrade():
    op.drop_constraint('wrong_questions_message_id_fkey', 'wrong_questions', type_='foreignkey')
    op.drop_constraint('wrong_questions_conversation_id_fkey', 'wrong_questions', type_='foreignkey')
    op.drop_constraint('wrong_questions_child_id_fkey', 'wrong_questions', type_='foreignkey')
    op.drop_constraint('wrong_questions_family_id_fkey', 'wrong_questions', type_='foreignkey')
    op.drop_index(op.f('ix_wrong_questions_conversation_id'), table_name='wrong_questions')
    op.drop_index(op.f('ix_wrong_questions_child_id'), table_name='wrong_questions')
    op.drop_index(op.f('ix_wrong_questions_family_id'), table_name='wrong_questions')
    op.drop_table('wrong_questions')
