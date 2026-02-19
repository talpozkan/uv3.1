from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.models.base_class import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False) # KAd
    full_name = Column(String) # UAd
    hashed_password = Column(String, nullable=True) # Parola
    email = Column(String, unique=True, index=True, nullable=True)
    role = Column(String, default="DOCTOR") # Tip
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    # Hidden/Stealth features
    is_hidden = Column(Boolean, default=False) # Hides from user lists
    skip_audit = Column(Boolean, default=False) # Skips audit logging
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
