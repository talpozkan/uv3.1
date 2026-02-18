import asyncio
import sys
import os
from pathlib import Path

# Add the project root to sys.path to allow importing from app
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

# Try to load environment variables
try:
    from dotenv import load_dotenv
    dotenv_path = backend_dir / ".env"
    if not dotenv_path.exists():
        dotenv_path = backend_dir.parent / ".env"
    if dotenv_path.exists():
        print(f"Loading environment from: {dotenv_path}")
        load_dotenv(dotenv_path)
except ImportError:
    pass

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# IMPORTANT: Import ALL models to avoid SQLAlchemy's relationship mapping errors
from app.models.user import User
from app.models.appointment import Randevu

try:
    from app.repositories.patient.models import ShardedPatientDemographics
except ImportError:
    print("Warning: ShardedPatientDemographics not found in expected repository path.")

from app.core.security import get_password_hash

# DATABASE_URL configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    db_user = os.getenv("DB_USER", "emr_admin")
    db_pass = os.getenv("DB_PASSWORD", "urolog123")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5441")
    db_name = os.getenv("DB_NAME", "urov3_db")
    DATABASE_URL = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

print(f"Using Database Connection: {DATABASE_URL.split('@')[0]}@...")

engine = create_async_engine(DATABASE_URL)
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def create_superuser():
    email = "alp@urolog.net.tr"
    username = "alp"
    full_name = "Alp Ozkan"
    # EXPLICITLY set password as requested by user
    password = "temp_pass_123" 
    
    print("-" * 30)
    print(f"Target Superuser: {email}")
    print(f"Username: {username}")
    print(f"Password set to: {password}")
    print("-" * 30)
    
    hashed_password = get_password_hash(password)
    
    async with SessionLocal() as session:
        # Simple existence check
        result = await session.execute(select(User).where((User.email == email) | (User.username == username)))
        user = result.scalars().first()
        
        if user:
            print(f"User EXISTS (ID: {user.id}). Updating profile...")
            user.email = email
            user.username = username
            user.hashed_password = hashed_password
            user.is_superuser = True
            user.is_active = True
            user.role = "DOCTOR"
            user.full_name = full_name
        else:
            print("User DOES NOT exist. Creating new record...")
            user = User(
                email=email,
                username=username,
                full_name=full_name,
                hashed_password=hashed_password,
                is_superuser=True,
                is_active=True,
                role="DOCTOR"
            )
            session.add(user)
        
        try:
            await session.commit()
            print(f"✅ SUCCESSFULLY created/updated superuser: {email}")
        except Exception as e:
            await session.rollback()
            print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(create_superuser())
