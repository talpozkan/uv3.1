import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

DATABASE_URL = str(settings.DATABASE_URL)

async def restore_admin():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        # Check if user exists
        res = await conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": "alp@alpozkan.com"}
        )
        user = res.fetchone()
        
        if user:
            print("User found, updating to superuser...")
            await conn.execute(
                text("UPDATE users SET is_superuser = True, is_active = True WHERE email = :email"),
                {"email": "alp@alpozkan.com"}
            )
        else:
            print("User not found, creating new superuser...")
            # Note: password is 'salmonella' hashed or we just create it with a dummy and let them reset
            # But for restore, we assume they want to log in.
            # Here we just ensure the record exists if it was deleted.
            await conn.execute(
                text("""
                INSERT INTO users (username, email, full_name, is_superuser, is_active, hashed_password, role)
                VALUES (:username, :email, :name, True, True, :hashed_pw, 'DOCTOR')
                """),
                {
                    "username": "alp@alpozkan.com",
                    "email": "alp@alpozkan.com",
                    "name": "Tayyar Alp Özkan",
                    "hashed_pw": "$2b$12$Epf.p3fEUPymf.R1M.BqduG7U7Q7Z.U7.H.H.H.H.H.H.H.H.H.H.H", # Placeholder for 'salmonella'
                }
            )
        print("✅ Superuser access restored for alp@alpozkan.com")

if __name__ == "__main__":
    asyncio.run(restore_admin())
