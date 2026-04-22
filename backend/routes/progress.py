from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
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
    stmt = sqlite_insert(Progress).values(
        material_id=data.material_id,
        current_page=data.current_page,
        completion_percent=data.completion_percent,
    ).on_conflict_do_update(
        index_elements=[Progress.material_id],
        set_={
            "current_page": data.current_page,
            "completion_percent": data.completion_percent,
            "last_read": func.now(),
        },
    )
    db.execute(stmt)
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
