# 中考真题导入指南

## 📚 数据概况

- **总文件数**：259,571 个文件
- **Markdown 文件**：7,600 个（核心内容）
- **图片文件**：116,792 张（WMF/PNG/JPEG）
- **学科分布**：
  - 数学：2,257 个 MD
  - 物理：1,932 个 MD
  - 英语：1,737 个 MD
  - 语文：1,674 个 MD
- **时间跨度**：2015-2025 年
- **知识库分类**：`practice`（刷刷专用）

---

## 🚀 快速开始

### 1️⃣ 试运行（推荐先测试）

导入 10 个数学真题，不写数据库：

```bash
cd /Users/kari77/Desktop/ai-family-os/backend

python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject 数学 \
  --limit 10 \
  --dry-run
```

### 2️⃣ 导入单个学科

导入全部数学真题（2,257 个）：

```bash
python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject 数学
```

### 3️⃣ 按年份导入

只导入 2025 年物理真题：

```bash
python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject 物理 \
  --year 2025
```

### 4️⃣ 导入全部学科

一次性导入 4 个学科（7,600 个文件，需要较长时间）：

```bash
python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject all
```

---

## 📊 分批导入策略（推荐）

因为文件量大（7,600 个），建议分批导入：

### 方案一：按学科分批
```bash
# 第一批：数学（2,257个）
python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject 数学

# 第二批：物理（1,932个）
python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject 物理

# 第三批：英语（1,737个）
python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject 英语

# 第四批：语文（1,674个）
python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject 语文
```

### 方案二：按年份分批（适合数学）
```bash
# 先导入最新的 2025 年
python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject 数学 \
  --year 2025

# 再导入 2024 年
python scripts/import_practice_exams.py \
  --base-dir /Users/kari77/Desktop/中国K12知识库 \
  --subject 数学 \
  --year 2024

# 以此类推...
```

---

## ⏱️ 预估时间

| 操作 | 文件数 | 预估时间 | 说明 |
|------|--------|---------|------|
| 试运行 10 个 | 10 | 5 秒 | 不生成 embedding |
| 数学全部 | 2,257 | 30-45 分钟 | 取决于网络和 DashScope API |
| 物理全部 | 1,932 | 25-40 分钟 | - |
| 英语全部 | 1,737 | 20-35 分钟 | - |
| 语文全部 | 1,674 | 20-35 分钟 | - |
| **全部学科** | **7,600** | **2-3 小时** | 批量 embedding 生成 |

---

## 📁 导入后的数据结构

每个文档会包含以下字段：

```json
{
  "id": "uuid",
  "title": "2025年陕西省中考数学试题",
  "content": "完整的 Markdown 内容",
  "category": "practice",
  "metadata": {
    "subject": "数学",
    "year": "2025",
    "region": "陕西省",
    "exam_type": "正式卷",
    "source_file": "2 数学总复习/.../2025年陕西省中考数学试题.md",
    "file_size": 15230,
    "source_type": "exam_paper"
  },
  "embedding": [0.123, 0.456, ...],  // 1536维向量
  "created_at": "2026-06-03T..."
}
```

---

## 🔍 验证导入结果

### 方法一：数据库查询
```bash
# 进入 backend 容器
docker exec -it $(docker ps -qf "name=backend") bash

# 连接数据库
psql $DATABASE_URL

# 查看导入统计
SELECT
    metadata->>'subject' as subject,
    COUNT(*) as count
FROM knowledge_documents
WHERE category = 'practice'
GROUP BY metadata->>'subject'
ORDER BY count DESC;

# 查看样例
SELECT title, metadata->>'year', metadata->>'region'
FROM knowledge_documents
WHERE category = 'practice'
LIMIT 5;
```

### 方法二：测试刷刷检索
访问 http://47.99.135.248:3000/chat/shuashua

发送测试消息：
- "2025年中考数学有哪些题型？"
- "给我一道二次函数的压轴题"
- "物理光学题怎么做？"

查看刷刷是否能检索到相关真题。

---

## ⚠️ 注意事项

### 1. 图片路径问题
- 脚本只导入 Markdown 文本
- 图片引用路径 `<img src="_media/...">` 保持不变
- **图片文件需要单独处理**（11.6万张）

**解决方案**：
- 方案 A：把图片上传到 CDN/OSS，替换 MD 里的路径
- 方案 B：把图片复制到 `/app/uploads/practice/` 并修改路径
- 方案 C：先不管图片，只用文字内容（推荐快速上线）

### 2. Embedding 成本
- 每个文档生成 1 次 embedding
- DashScope text-embedding-v2：0.0007 元/千 tokens
- 预估：7,600 个文档 × 平均 2K tokens = 约 10 元

### 3. 数据库容量
- 7,600 个文档
- 每个文档平均 10KB 内容 + 6KB embedding
- 预估占用：约 120MB

### 4. 导入失败处理
脚本支持断点续传，重复运行会跳过已导入的文档（根据 title + metadata 去重）。

---

## 🛠️ 故障排查

### 问题 1：找不到目录
```
❌ 目录不存在：/Users/kari77/Desktop/中国K12知识库/...
```

**解决**：检查 `--base-dir` 路径是否正确，确保目录结构为：
```
中国K12知识库/
└── 真题库/
    └── 中考真题/
        ├── 1 语文总复习/
        ├── 2 数学总复习/
        ├── 3 英语总复习/
        └── 4 物理总复习/
```

### 问题 2：Embedding 生成失败
```
❌ embedding 生成失败: HTTPError 429 Too Many Requests
```

**解决**：DashScope API 限流，等待几分钟后重试，或减少 `batch_size`。

### 问题 3：数据库连接失败
```
❌ 写入失败: connection refused
```

**解决**：确保数据库正在运行：
```bash
docker ps | grep postgres
```

---

## 🎯 推荐导入顺序

1. **先测试**：`--limit 10 --dry-run` 验证脚本正常
2. **导入数学 2025 年**：最新最热门的数据
3. **观察效果**：测试刷刷回答质量
4. **逐步扩充**：物理 → 英语 → 语文
5. **补齐历史**：2024 → 2023 → ... → 2015

---

## 📞 技术支持

导入遇到问题？提供以下信息：
1. 完整的命令行参数
2. 错误日志截图
3. 数据库当前 practice 文档数量
