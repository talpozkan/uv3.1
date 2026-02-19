import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.services.audit_service import AuditService
from app.core.config import settings
from app.models.user import User
from sqlalchemy.future import select

DATABASE_URL = settings.DATABASE_URL

async def test_audit():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("Fetching admin user...")
        result = await db.execute(select(User).filter(User.email == "admin@example.com"))
        user = result.scalars().first()
        if not user:
            print("User not found! Run login test first.")
            return

        print(f"Attempting audit log for user {user.id}...")
        try:
            log = await AuditService.log(
                db=db,
                action="TEST_ACTION",
                user_id=user.id,
                details={"test": "repro"}
            )
            if log:
                print("Audit log created successfully!")
            else:
                print("AuditService.log returned None (failed silently).")
        except Exception as e:
            print("AuditService failed with exception:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    try:
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(test_audit())
    except Exception as e:
        print(f"Script failed: {e}")
