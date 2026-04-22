from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String, default="Sbulele")
    personality = Column(String, default="friendly")
    streak = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

class Material(Base):
    __tablename__ = "materials"
    id = Column(Integer, primary_key=True)
    title = Column(String)
    file_path = Column(String)
    total_pages = Column(Integer, default=0)
    content_text = Column(String)
    created_at = Column(DateTime, server_default=func.now())

class Progress(Base):
    __tablename__ = "progress"
    id = Column(Integer, primary_key=True)
    material_id = Column(Integer, unique=True, index=True)
    current_page = Column(Integer, default=0)
    completion_percent = Column(Float, default=0.0)
    last_read = Column(DateTime, server_default=func.now())

class StudySession(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True)
    material_id = Column(Integer)
    study_time = Column(Integer, default=0)
    date = Column(DateTime, server_default=func.now())
