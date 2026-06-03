import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean,
    DateTime, ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=True)
    password_hash = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False, default="parent")  # parent / admin / consultant
    status = Column(String(20), nullable=False, default="active")  # active / disabled
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    family = relationship("Family", back_populates="owner", uselist=False)


class Family(Base):
    __tablename__ = "families"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    family_name = Column(String(100), nullable=False)
    city = Column(String(50), nullable=True)

    # 兼容旧字段，不再参与权限判断，后续迁移废弃
    membership_level = Column(String(30), default="free")
    monthly_quota = Column(Integer, nullable=True, default=5)  # NULL = 不限（pilot_9800）

    # 订阅主字段 —— 权限判断统一看这里
    subscription_plan = Column(String(30), nullable=True)       # free/trial_9_9/community_3480/pilot_9800
    subscription_started_at = Column(DateTime, nullable=True)   # 开通时间
    subscription_expires_at = Column(DateTime, nullable=True)   # 到期时间，NULL=永久有效
    assessment_quota = Column(Integer, default=0)               # 剩余测评次数
    report_quota = Column(Integer, default=0)                   # 剩余报告次数

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="family")
    children = relationship("ChildProfile", back_populates="family")
    conversations = relationship("Conversation", back_populates="family")


class ChildProfile(Base):
    __tablename__ = "children_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    age = Column(Integer, nullable=True)
    grade = Column(String(20), nullable=True)
    interests = Column(Text, nullable=True)  # 兴趣爱好
    learning_challenges = Column(Text, nullable=True)  # 学习卡点
    parent_expectations = Column(Text, nullable=True)  # 家长期待
    ai_profile = Column(JSONB, nullable=True)  # AI 持续更新的孩子画像
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    family = relationship("Family", back_populates="children")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children_profiles.id"), nullable=True)
    agent_type = Column(String(20), nullable=False)  # xuexue / chuangchuang / tantan / banban
    title = Column(String(200), nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    family = relationship("Family", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user / assistant / system
    content = Column(Text, nullable=False)
    model_name = Column(String(50), nullable=True)
    tokens_input = Column(Integer, nullable=True)
    tokens_output = Column(Integer, nullable=True)
    retrieved_chunks = Column(JSONB, nullable=True)  # RAG检索到的知识片段
    risk_level = Column(String(20), nullable=True)  # none / low / medium / high
    feedback = Column(String(10), nullable=True)  # useful / not_useful
    feedback_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)  # learning / project / talent / parenting
    source_type = Column(String(20), nullable=True)  # pdf / md / txt
    file_path = Column(String(500), nullable=True)
    raw_text = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending / processing / completed / failed
    created_at = Column(DateTime, default=datetime.utcnow)

    chunks = relationship("KnowledgeChunk", back_populates="doc")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_docs.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # learning / project / talent / parenting
    tags = Column(ARRAY(String), nullable=True)
    embedding = Column(Vector(1536), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    doc = relationship("KnowledgeDoc", back_populates="chunks")


class RiskFlag(Base):
    __tablename__ = "risk_flags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False)
    risk_type = Column(String(50), nullable=False)  # self_harm / violence / bullying / abuse
    risk_level = Column(String(20), nullable=False)  # medium / high / critical
    content_snapshot = Column(Text, nullable=False)
    handled = Column(Boolean, default=False)
    handler_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    handled_at = Column(DateTime, nullable=True)


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action_type = Column(String(50), nullable=False)  # chat / upload / search
    agent_type = Column(String(20), nullable=True)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    cost_estimate = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Consultant(Base):
    """专家/顾问"""
    __tablename__ = "consultants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # 可关联用户账号
    name = Column(String(50), nullable=False)
    title = Column(String(100), nullable=True)  # 头衔，如"教育学博士"
    bio = Column(Text, nullable=True)  # 个人介绍
    specialties = Column(Text, nullable=True)  # 擅长领域
    avatar_url = Column(String(500), nullable=True)
    price_per_session = Column(Integer, default=0)  # 单次咨询价格（分）
    session_duration = Column(Integer, default=40)  # 每次咨询时长（分钟）
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    schedules = relationship("ConsultantSchedule", back_populates="consultant")
    bookings = relationship("Booking", back_populates="consultant")


class ConsultantSchedule(Base):
    """专家可用时段配置"""
    __tablename__ = "consultant_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultant_id = Column(UUID(as_uuid=True), ForeignKey("consultants.id"), nullable=False, index=True)
    weekday = Column(Integer, nullable=False)  # 0=周一, 6=周日
    time_slots = Column(JSONB, nullable=False)  # ["09:00","10:00","14:00","15:00","16:00"]
    is_active = Column(Boolean, default=True)

    consultant = relationship("Consultant", back_populates="schedules")


class Booking(Base):
    """咨询预约"""
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    consultant_id = Column(UUID(as_uuid=True), ForeignKey("consultants.id"), nullable=False, index=True)
    booking_date = Column(String(10), nullable=False)  # "2026-05-20"
    time_slot = Column(String(5), nullable=False)  # "14:00"
    duration = Column(Integer, default=40)  # 分钟
    topic = Column(Text, nullable=True)  # 咨询主题
    notes = Column(Text, nullable=True)  # 备注
    status = Column(String(20), default="pending")  # pending / confirmed / cancelled / completed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    consultant = relationship("Consultant", back_populates="bookings")


class ConsultationRecord(Base):
    """咨询记录（咨询完成后的数据沉淀）"""
    __tablename__ = "consultation_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False, index=True)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children_profiles.id"), nullable=True)
    consultant_id = Column(UUID(as_uuid=True), ForeignKey("consultants.id"), nullable=False)
    # 逐字稿
    transcript = Column(Text, nullable=True)
    # 咨询总结
    summary = Column(Text, nullable=True)
    key_findings = Column(JSONB, nullable=True)  # ["发现1", "发现2"]
    # 规划方案
    plan_json = Column(JSONB, nullable=True)  # {goals: [], milestones: [], recommendations: []}
    # 标签提取（自动更新到学生画像）
    extracted_tags = Column(JSONB, nullable=True)  # [{tag_name, tag_category, confidence}]
    # 状态
    status = Column(String(20), default="draft")  # draft / completed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    booking = relationship("Booking")


class GrowthReport(Base):
    """月度成长报告"""
    __tablename__ = "growth_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children_profiles.id"), nullable=True)
    month = Column(String(7), nullable=False)  # "2026-05"
    summary = Column(Text, nullable=True)  # 一句话总结
    content_json = Column(JSONB, nullable=False)  # 结构化报告内容
    conversation_count = Column(Integer, default=0)  # 当月对话数
    generated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class GrowthTag(Base):
    """成长画像标签"""
    __tablename__ = "growth_tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children_profiles.id"), nullable=False, index=True)
    tag_name = Column(String(50), nullable=False)
    tag_category = Column(String(30), nullable=False)  # learning_style / interest / personality / potential
    confidence = Column(Float, default=0.8)  # 0-1 置信度
    source = Column(String(20), default="ai")  # ai / manual
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Subscription(Base):
    """付费订阅"""
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    plan = Column(String(20), nullable=False, default="free")  # free / basic / premium
    monthly_quota = Column(Integer, default=30)  # 每月对话次数
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AgentPrompt(Base):
    """Agent 提示词配置（可在后台编辑）"""
    __tablename__ = "agent_prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_type = Column(String(20), unique=True, nullable=False, index=True)  # xuexue / chuangchuang / tantan / banban
    name = Column(String(50), nullable=False)  # 显示名称
    role = Column(String(100), nullable=False)  # 角色描述
    system_prompt = Column(Text, nullable=False)  # 系统提示词
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    examples = relationship("AgentExample", back_populates="agent_prompt", cascade="all, delete-orphan")


class AgentExample(Base):
    """Agent 案例库（few-shot examples）"""
    __tablename__ = "agent_examples"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_prompt_id = Column(UUID(as_uuid=True), ForeignKey("agent_prompts.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)  # 案例标题
    user_input = Column(Text, nullable=False)  # 用户输入示例
    assistant_output = Column(Text, nullable=False)  # 期望的AI回复
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    agent_prompt = relationship("AgentPrompt", back_populates="examples")


# ============ 测评系统 ============

class AssessmentTemplate(Base):
    """测评模板（题目配置）"""
    __tablename__ = "assessment_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(100), nullable=False)  # "学习风格测评"
    category = Column(String(30), nullable=False)  # learning_style / personality / subject_interest / learning_system
    description = Column(Text, nullable=True)  # 测评说明
    target_age_min = Column(Integer, default=8)
    target_age_max = Column(Integer, default=18)
    questions_json = Column(JSONB, nullable=False)  # [{question, options: [{label, value}], type: "single"/"scale"}]
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AssessmentRecord(Base):
    """测评记录（用户答题）"""
    __tablename__ = "assessment_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children_profiles.id"), nullable=False, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("assessment_templates.id"), nullable=False)
    filled_by = Column(String(20), nullable=False, default="child")  # child / parent
    answers_json = Column(JSONB, nullable=False)  # [{question_index, selected_value}]
    scores_json = Column(JSONB, nullable=True)  # 计算后的各维度得分
    status = Column(String(20), default="completed")  # completed
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("AssessmentTemplate")


class AssessmentReport(Base):
    """测评报告（AI生成+人工审核）"""
    __tablename__ = "assessment_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children_profiles.id"), nullable=False, index=True)
    record_id = Column(UUID(as_uuid=True), ForeignKey("assessment_records.id"), nullable=False)
    ai_content_json = Column(JSONB, nullable=True)  # AI生成的报告内容
    consultant_notes = Column(Text, nullable=True)  # 咨询师补充意见
    final_content_json = Column(JSONB, nullable=True)  # 最终发布的报告内容
    status = Column(String(20), default="draft")  # draft / reviewed / published
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)  # 审核人
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    record = relationship("AssessmentRecord")


class WrongQuestion(Base):
    """错题记录 - 刷刷智能体的错题本"""
    __tablename__ = "wrong_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children_profiles.id"), nullable=True, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True, index=True)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True)

    # 题目内容
    subject = Column(String(50), nullable=True)  # 学科：数学/英语/物理/化学等
    grade = Column(String(20), nullable=True)    # 年级：小学/初中/高中
    question_text = Column(Text, nullable=True)  # 题目文字
    image_url = Column(String(500), nullable=True)  # 题目图片

    # AI 分析结果
    knowledge_points = Column(ARRAY(String), nullable=True)  # 知识点列表
    mistake_reason = Column(Text, nullable=True)  # 错因分析
    ai_explanation = Column(Text, nullable=True)  # AI 讲解（完整回答）
    similar_questions = Column(Text, nullable=True)  # 类似题（AI 生成的练习题）

    # 状态管理
    status = Column(String(20), default="new")  # new / reviewing / mastered

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
