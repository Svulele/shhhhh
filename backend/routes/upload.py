from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Material
import pypdf
import io
import os
import re
from pathlib import Path
from typing import Optional
from uuid import uuid4

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def sanitize_filename(filename: Optional[str]) -> str:
    raw_name = Path(filename or "").name.strip()
    if not raw_name:
        return "upload"

    stem = Path(raw_name).stem or "upload"
    suffix = Path(raw_name).suffix
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._") or "upload"
    safe_suffix = re.sub(r"[^A-Za-z0-9.]+", "", suffix)[:10]
    return f"{safe_stem}{safe_suffix}"


def build_storage_path(filename: str) -> str:
    safe_name = sanitize_filename(filename)
    suffix = Path(safe_name).suffix
    unique_name = f"{Path(safe_name).stem}_{uuid4().hex[:12]}{suffix}"
    return os.path.join(UPLOAD_DIR, unique_name)

@router.post("/")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        safe_title = sanitize_filename(file.filename)
        file_path = build_storage_path(safe_title)
        
        with open(file_path, "wb") as f:
            f.write(contents)

        content_text = ""
        total_pages = 0

        if file.filename.endswith(".pdf"):
            reader = pypdf.PdfReader(io.BytesIO(contents))
            total_pages = len(reader.pages)
            for page in reader.pages:
                content_text += page.extract_text() or ""
        else:
            content_text = contents.decode("utf-8", errors="ignore")
            total_pages = max(1, len(content_text) // 1800)

        material = Material(
            title=safe_title,
            file_path=file_path,
            total_pages=total_pages,
            content_text=content_text,
        )
        db.add(material)
        db.commit()
        db.refresh(material)

        return {
            "id": material.id,
            "title": material.title,
            "total_pages": material.total_pages,
            "preview": content_text[:500],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/materials")
def get_materials(db: Session = Depends(get_db)):
    materials = db.query(Material).all()
    return [{"id": m.id, "title": m.title, "total_pages": m.total_pages} for m in materials]
