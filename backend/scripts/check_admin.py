import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.user import User
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

async def check_admin():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        email = "admin@urolog.com"
        result = await db.execute(select(User).filter(User.email == email))
        user = result.scalars().first()
        
        if user:
            print(f"User {email} found! ID: {user.id}")
        else:
            print(f"User {email} NOT found.")
            # Create if missing
            print("Creating admin user...")
            from app.core import security
            hashed_pw = security.get_password_hash("admin123")
            new_user = User(
                email=email,
                username=email,
                hashed_password=hashed_pw,
                full_name="Admin User",
                is_active=True,
                is_superuser=True,
                role="ADMIN"
            )
            db.add(new_user)
            await db.commit()
            print("User created.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(check_admin())
