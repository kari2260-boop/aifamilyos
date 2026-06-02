"""
检查文章内容中的图片路径，找出需要修正的本地路径
运行方式：python scripts/check_article_paths.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models.article import Article
import re

def main():
    db = SessionLocal()
    try:
        articles = db.query(Article).filter(Article.is_published == True).all()
        print(f"共 {len(articles)} 篇已发布文章\n")

        issues = []
        for article in articles:
            if not article.content_markdown:
                continue

            # 检查是否有本地绝对路径
            local_paths = re.findall(r'!\[.*?\]\(((?:/Users/|/home/|C:\\|file://)[^\)]+)\)', article.content_markdown)
            if local_paths:
                issues.append({
                    "id": str(article.id),
                    "title": article.title,
                    "paths": local_paths
                })

            # 检查是否有 localhost 残留
            localhost_urls = re.findall(r'!\[.*?\]\((http://localhost[^\)]+)\)', article.content_markdown)
            if localhost_urls:
                issues.append({
                    "id": str(article.id),
                    "title": article.title,
                    "localhost": localhost_urls
                })

        if not issues:
            print("✅ 所有文章图片路径正常，无需修正")
        else:
            print(f"⚠️  发现 {len(issues)} 篇文章需要修正：\n")
            for issue in issues:
                print(f"文章 ID: {issue['id']}")
                print(f"标题: {issue['title']}")
                if issue.get('paths'):
                    print(f"本地路径: {issue['paths']}")
                if issue.get('localhost'):
                    print(f"localhost 残留: {issue['localhost']}")
                print()

    finally:
        db.close()

if __name__ == "__main__":
    main()
