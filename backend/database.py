from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./shhhh.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def init_db():
    from models import User, Material, Progress, StudySession
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        # Collapse any pre-existing duplicate progress rows before enforcing uniqueness.
        conn.execute(text("""
            DELETE FROM progress
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM progress
                GROUP BY material_id
            )
        """))
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS ix_progress_material_id_unique
            ON progress(material_id)
        """))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
