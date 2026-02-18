"""
User Management Script
- Adds missing columns to users table if they don't exist
- Creates test users for login testing
"""
import asyncio
import os
import sys
from sqlalchemy import text
from passlib.context import CryptContext

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def add_missing_columns():
    """Add email and is_superuser columns if they don't exist."""
    async with SessionLocal() as session:
        # Check and add 'email' column
        result = await session.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'email'
        """))
        if not result.scalar():
            print("Adding 'email' column to users table...")
            await session.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR UNIQUE"))
            await session.commit()
            print("'email' column added.")
        else:
            print("'email' column already exists.")
        
        # Check and add 'is_superuser' column
        result = await session.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_superuser'
        """))
        if not result.scalar():
            print("Adding 'is_superuser' column to users table...")
            await session.execute(text("ALTER TABLE users ADD COLUMN is_superuser BOOLEAN DEFAULT FALSE"))
            await session.commit()
            print("'is_superuser' column added.")
        else:
            print("'is_superuser' column already exists.")


async def create_user(username: str, password: str, full_name: str, role: str = "DOCTOR", email: str = None, is_superuser: bool = False):
    """Create a new user if not exists."""
    async with SessionLocal() as session:
        # Check if user exists
        result = await session.execute(text("SELECT id FROM users WHERE username = :u"), {"u": username})
        user = result.scalar()
        
        if user:
            print(f"User '{username}' already exists (ID: {user}).")
            return user
        else:
            hashed_pw = get_password_hash(password)
            result = await session.execute(
                text("""
                    INSERT INTO users (username, hashed_password, is_active, full_name, role, email, is_superuser) 
                    VALUES (:u, :p, :a, :n, :r, :e, :s)
                    RETURNING id
                """),
                {"u": username, "p": hashed_pw, "a": True, "n": full_name, "r": role, "e": email, "s": is_superuser}
            )
            new_id = result.scalar()
            await session.commit()
            print(f"User '{username}' created with password '{password}' (ID: {new_id}).")
            return new_id


async def list_users():
    """List all users in the database."""
    async with SessionLocal() as session:
        result = await session.execute(text("SELECT id, username, full_name, role, is_active, email, is_superuser FROM users"))
        users = result.fetchall()
        
        print("\n--- USERS TABLE ---")
        print(f"{'ID':<5} {'Username':<15} {'Full Name':<25} {'Role':<12} {'Active':<8} {'Superuser':<10} {'Email'}")
        print("-" * 100)
        for u in users:
            print(f"{u[0]:<5} {u[1]:<15} {u[2] or '-':<25} {u[3] or '-':<12} {str(u[4]):<8} {str(u[6] if len(u) > 6 else '-'):<10} {u[5] or '-'}")
        print("-" * 100)
        print(f"Total: {len(users)} users\n")


async def main():
    print("=" * 50)
    print("USER MANAGEMENT SCRIPT")
    print("=" * 50)
    
    # Step 1: Add missing columns
    print("\n[1] Checking and adding missing columns...")
    await add_missing_columns()
    
    # Step 2: Create test users
    print("\n[2] Creating test users...")
    
    # Admin user (superuser)
    await create_user(
        username="admin",
        password="admin123",
        full_name="Sistem Yöneticisi",
        role="ADMIN",
        email="admin@urolog.com",
        is_superuser=True
    )
    
    # Doctor user
    await create_user(
        username="dr_mehmet",
        password="mehmet123",
        full_name="Dr. Mehmet Yılmaz",
        role="DOCTOR",
        email="mehmet@urolog.com",
        is_superuser=False
    )
    
    # Nurse user
    await create_user(
        username="hemsire_ayse",
        password="ayse123",
        full_name="Hemşire Ayşe Kaya",
        role="NURSE",
        email="ayse@urolog.com",
        is_superuser=False
    )

    # Secretary user
    await create_user(
        username="sekreter_ali",
        password="ali123",
        full_name="Ali Demir",
        role="SECRETARY",
        email="ali@urolog.com",
        is_superuser=False
    )
    
    # Step 3: List all users
    print("\n[3] Current users in database:")
    await list_users()
    
    print("=" * 50)
    print("DONE! You can now test login with these credentials:")
    print("  - admin / admin123 (Süper Admin)")
    print("  - dr_mehmet / mehmet123 (Doktor)")
    print("  - hemsire_ayse / ayse123 (Hemşire)")
    print("  - sekreter_ali / ali123 (Sekreter)")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
