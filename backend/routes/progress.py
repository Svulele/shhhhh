from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import Progress, StudySession

router = APIRouter()

class ProgressUpdate(BaseModel):
    material_id: int
    current_page: int
    completion_percent: float

class SessionLog(BaseModel):
    material_id: int
    study_time: int

@router.post("/update")
def update_progress(data: ProgressUpdate, db: Session = Depends(get_db)):
    prog = db.query(Progress).filter(Progress.material_id == data.material_id).first()
    if prog:
        prog.current_page = data.current_page
        prog.completion_percent = data.completion_percent
    else:
        prog = Progress(**data.dict())
        db.add(prog)
    db.commit()
    return {"status": "updated"}

@router.get("/{material_id}")
def get_progress(material_id: int, db: Session = Depends(get_db)):
    prog = db.query(Progress).filter(Progress.material_id == material_id).first()
    if not prog:
        return {"current_page": 0, "completion_percent": 0.0}
    return {"current_page": prog.current_page, "completion_percent": prog.completion_percent}

@router.post("/session")
def log_session(data: SessionLog, db: Session = Depends(get_db)):
    session = StudySession(**data.dict())
    db.add(session)
    db.commit()
    return {"status": "logged"}