from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Material
import pypdf
import io
import os

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        
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
            title=file.filename,
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