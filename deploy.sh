#!/bin/bash
# AI 家庭成长 OS - 服务器部署脚本
# 在腾讯云服务器上执行

set -e

echo "=== AI 家庭成长 OS 部署 ==="

BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/kari2260-boop/aifamilyos.git}"
APP_DIR="/opt/ai-family-os"

# 1. 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

if ! command -v docker compose &> /dev/null; then
    echo "错误: docker compose 未安装"
    exit 1
fi

echo "Docker 版本: $(docker --version)"

# 2. 拉取代码
if [ ! -d "$APP_DIR/.git" ]; then
    echo "克隆代码..."
    git clone "$REPO_URL" "$APP_DIR"
else
    echo "更新代码..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

CURRENT_COMMIT="$(git rev-parse HEAD)"
echo "当前部署 commit: $CURRENT_COMMIT"

# 3. 检查配置
if [ ! -f ".env.production" ]; then
    echo "错误: 请先创建 .env.production 文件"
    echo "参考 .env.production.example"
    exit 1
fi

# 4. 构建并启动
echo "构建镜像..."
docker compose -f docker-compose.prod.yml build

echo "启动服务..."
docker compose -f docker-compose.prod.yml up -d

# 5. 等待数据库就绪
echo "等待数据库..."
sleep 10

# 6. 健康检查
echo "检查服务状态..."
docker compose -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1/health >/dev/null

echo ""
echo "=== 部署完成 ==="
echo "前端: http://your-domain.com"
echo "后端: http://your-domain.com/api"
echo "管理后台: http://your-domain.com/admin"
echo "部署 commit: $CURRENT_COMMIT"
echo ""
echo "下一步:"
echo "1. 配置 SSL 证书到 nginx/ssl/"
echo "2. 修改 nginx.conf 中的 server_name"
echo "3. docker compose -f docker-compose.prod.yml restart nginx"
