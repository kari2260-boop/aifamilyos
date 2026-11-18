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

# 5. 配置宿主机 nginx 反代
if command -v nginx >/dev/null 2>&1; then
    echo "配置宿主机 nginx..."
    install -d /etc/nginx/sites-available /etc/nginx/sites-enabled
    cp nginx/nginx.host.conf /etc/nginx/sites-available/ai-family-os.conf
    ln -sf /etc/nginx/sites-available/ai-family-os.conf /etc/nginx/sites-enabled/ai-family-os.conf
    if [ -f /etc/nginx/sites-enabled/default ]; then
        rm -f /etc/nginx/sites-enabled/default
    fi
    nginx -t
    systemctl reload nginx || systemctl restart nginx
else
    echo "警告: 宿主机 nginx 未安装，已仅启动容器服务。"
    echo "       需要在服务器上安装 nginx 并加载 nginx/nginx.host.conf 才能通过 80 端口访问。"
fi

# 6. 等待数据库就绪
echo "等待数据库..."
sleep 10

# 7. 健康检查
echo "检查服务状态..."
docker compose -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:8000/health >/dev/null

echo ""
echo "=== 部署完成 ==="
echo "前端: http://your-domain.com"
echo "后端: http://your-domain.com/api"
echo "管理后台: http://your-domain.com/admin"
echo "部署 commit: $CURRENT_COMMIT"
echo ""
echo "下一步:"
echo "1. 如需 HTTPS，再为宿主机 nginx 配置证书"
echo "2. 确认宿主机 nginx 已加载 ai-family-os.conf"
echo "3. 如需重新部署，重复执行 deploy.sh"
