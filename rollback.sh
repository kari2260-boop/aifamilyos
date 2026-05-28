#!/bin/bash
# AI 家庭成长 OS - 回滚脚本
# 用法: ./rollback.sh [commit_hash]
# 不传参数则回滚到上一个 commit

set -e

echo "=== AI 家庭成长 OS 回滚 ==="

# 确认在正确目录
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "错误: 请在项目根目录执行此脚本"
    exit 1
fi

# 获取目标 commit
CURRENT=$(git rev-parse --short HEAD)
TARGET=${1:-$(git rev-parse --short HEAD~1)}

echo "当前版本: $CURRENT"
echo "回滚目标: $TARGET"
echo ""
read -p "确认回滚? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "已取消"
    exit 0
fi

# 回滚代码
echo "切换到 $TARGET ..."
git checkout "$TARGET"

# 重新构建并重启
echo "重新构建镜像..."
docker compose -f docker-compose.prod.yml build

echo "重启服务..."
docker compose -f docker-compose.prod.yml up -d

# 等待服务就绪
echo "等待服务就绪..."
sleep 10

# 健康检查
echo "健康检查..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 回滚成功，服务正常"
    echo "当前版本: $(git rev-parse --short HEAD)"
else
    echo "⚠️  服务响应异常 (HTTP $HTTP_CODE)，请手动检查"
    echo "查看日志: docker compose -f docker-compose.prod.yml logs --tail=50"
fi
