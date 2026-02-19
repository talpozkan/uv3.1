
import asyncio
import sys

# Set sys.path to find 'app'
sys.path.append("/app")

# Ensure all models are loaded to avoid registry errors
from app.repositories.patient.models import ShardedPatientDemographics
from app.models.user import User
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from sqlalchemy import select

async def reset_password():
    new_password = "salmonella"
    hashed_pw = get_password_hash(new_password)
    
    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.email == "alp@alpozkan.com"))
        user = result.scalars().first()
        
        if user:
            print(f"Updating password for user: {user.email}")
            user.hashed_password = hashed_pw
            user.is_active = True
            user.is_superuser = True
            session.add(user)
            await session.commit()
            print("✅ Password updated successfully.")
        else:
            print("❌ User not found.")

if __name__ == "__main__":
    asyncio.run(reset_password())
