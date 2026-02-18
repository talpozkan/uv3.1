import asyncio
import sys
import os

# Add parent directory to path to allow importing app
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from sqlalchemy import select

async def create_user():
    print("Connecting to database...")
    async with SessionLocal() as db:
        # Check if user exists
        query = select(User).where(User.email == "alpozkan@gmail.com")
        result = await db.execute(query)
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print("User alpozkan@gmail.com already exists. Updating password...")
            existing_user.hashed_password = get_password_hash("urolog123")
            existing_user.is_active = True
            existing_user.is_superuser = True
        else:
            print("Creating new user alpozkan@gmail.com...")
            new_user = User(
                email="alpozkan@gmail.com",
                username="admin",
                hashed_password=get_password_hash("urolog123"),
                full_name="Alp Ozkan",
                is_active=True,
                is_superuser=True
            )
            db.add(new_user)
        
        try:
            await db.commit()
            print("Operation successful! Password set to: urolog123")
        except Exception as e:
            await db.rollback()
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(create_user())
