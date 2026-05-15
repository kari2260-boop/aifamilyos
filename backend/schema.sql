-- AI Family OS 数据库 Schema
-- 此文件仅作参考，实际建表由 SQLAlchemy 自动完成

CREATE EXTENSION IF NOT EXISTS vector;

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'parent',  -- parent / admin / consultant
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 家庭表
CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id),
    family_name VARCHAR(100) NOT NULL,
    city VARCHAR(50),
    membership_level VARCHAR(20) DEFAULT 'free',
    monthly_quota INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 孩子档案
CREATE TABLE children_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    name VARCHAR(50) NOT NULL,
    age INTEGER,
    grade VARCHAR(20),
    interests TEXT,
    learning_challenges TEXT,
    parent_expectations TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 对话表
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    child_id UUID REFERENCES children_profiles(id),
    agent_type VARCHAR(20) NOT NULL,  -- xuexue / chuangchuang / tantan / banban
    title VARCHAR(200),
    summary TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 消息表
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    role VARCHAR(20) NOT NULL,  -- user / assistant / system
    content TEXT NOT NULL,
    model_name VARCHAR(50),
    tokens_input INTEGER,
    tokens_output INTEGER,
    retrieved_chunks JSONB,
    risk_level VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 知识库文档
CREATE TABLE knowledge_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,  -- learning / project / talent / parenting
    source_type VARCHAR(20),
    file_path VARCHAR(500),
    raw_text TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 知识库切片
CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES knowledge_docs(id),
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    tags TEXT[],
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 风险标记
CREATE TABLE risk_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    message_id UUID NOT NULL REFERENCES messages(id),
    risk_type VARCHAR(50) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    content_snapshot TEXT NOT NULL,
    handled BOOLEAN DEFAULT FALSE,
    handler_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    handled_at TIMESTAMP
);

-- 使用量日志
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    agent_type VARCHAR(20),
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_estimate FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_families_owner ON families(owner_user_id);
CREATE INDEX idx_children_family ON children_profiles(family_id);
CREATE INDEX idx_conversations_family ON conversations(family_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_chunks_doc ON knowledge_chunks(doc_id);
CREATE INDEX idx_chunks_category ON knowledge_chunks(category);
CREATE INDEX idx_risk_flags_family ON risk_flags(family_id);
CREATE INDEX idx_usage_logs_family ON usage_logs(family_id);
