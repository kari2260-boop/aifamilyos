"""
Upload Router - 文件上传接口
POST /upload/video   上传视频文件
POST /upload/image   上传图片（封面等）
"""
import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

from app.utils.auth import require_admin
from app.models.models import User

router = APIRouter(tags=["文件上传"])

UPLOAD_DIR = "/app/uploads"
VIDEO_DIR = os.path.join(UPLOAD_DIR, "videos")
IMAGE_DIR = os.path.join(UPLOAD_DIR, "images")

# 确保目录存在
os.makedirs(VIDEO_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)

ALLOWED_VIDEO_TYPES = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
ALLOWED_IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500MB
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB


@router.post("/upload/video")
async def upload_video(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
):
    """上传视频文件（管理员），自动转码支持快进"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名为空")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail=f"不支持的视频格式: {ext}")

    # 生成唯一文件名
    file_id = uuid.uuid4().hex
    temp_path = os.path.join(VIDEO_DIR, f"_temp_{file_id}{ext}")
    final_path = os.path.join(VIDEO_DIR, f"{file_id}.mp4")

    # 写入临时文件
    content = await file.read()
    if len(content) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail="视频文件超过500MB限制")

    with open(temp_path, "wb") as f:
        f.write(content)

    # ffmpeg 转码（faststart，支持拖动快进）
    import subprocess
    try:
        result = subprocess.run(
            ["ffmpeg", "-i", temp_path, "-movflags", "+faststart", "-c", "copy", final_path],
            capture_output=True, timeout=300,
        )
        os.remove(temp_path)
        if result.returncode != 0:
            # 转码失败，直接用原文件
            os.rename(temp_path, final_path) if os.path.exists(temp_path) else None
    except Exception:
        # ffmpeg不可用，直接用原文件
        if os.path.exists(temp_path):
            os.rename(temp_path, final_path)

    filename = f"{file_id}.mp4"
    return {
        "filename": filename,
        "url": f"/api/static/videos/{filename}",
        "size": len(content),
        "original_name": file.filename,
    }


@router.post("/upload/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
):
    """上传图片（封面图等，管理员）"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名为空")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"不支持的图片格式: {ext}")

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(IMAGE_DIR, filename)

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="图片文件超过10MB限制")

    with open(filepath, "wb") as f:
        f.write(content)

    return {
        "filename": filename,
        "url": f"/api/static/images/{filename}",
        "size": len(content),
        "original_name": file.filename,
    }


# 文件访问接口（用户端播放/查看）
from pathlib import Path

def _safe_filepath(base_dir: str, filename: str) -> str:
    """防止路径穿越攻击"""
    resolved = Path(os.path.join(base_dir, filename)).resolve()
    if not resolved.is_relative_to(Path(base_dir).resolve()):
        raise HTTPException(status_code=403, detail="非法路径")
    return str(resolved)


@router.get("/files/videos/{filename}")
async def serve_video(filename: str):
    """提供视频文件访问"""
    filepath = _safe_filepath(VIDEO_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    file_size = os.path.getsize(filepath)
    return FileResponse(
        filepath,
        media_type="video/mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        },
    )


@router.get("/files/images/{filename}")
async def serve_image(filename: str):
    """提供图片文件访问"""
    filepath = _safe_filepath(IMAGE_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    # 根据扩展名设置 content type
    ext = os.path.splitext(filename)[1].lower()
    media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}
    return FileResponse(filepath, media_type=media_types.get(ext, "image/jpeg"))
