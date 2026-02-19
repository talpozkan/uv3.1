import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.api.deps import get_db
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.core.config import settings

# Override DB URL if needed, but should pick up from env or .env
DATABASE_URL = settings.DATABASE_URL

async def test_login():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        repo = UserRepository(db)
        service = AuthService(repo)
        
        email = "admin@urolog.com" 
        password = "admin123" 
        
        print(f"Attempting login for {email}...")
        try:
            # First check if user exists
            user = await repo.get_by_email(email)
            if not user:
                print("User not found via repo! Creating user...")
                from app.models.user import User
                from app.core import security
                hashed_pw = security.get_password_hash(password)
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
            
            # Now authenticate
            result = await service.authenticate_user(email, password)
            print("Login successful!")
            print(result)
        except Exception as e:
            print("Login failed with exception:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    try:
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(test_login())
    except Exception as e:
        print(f"Script failed: {e}")
