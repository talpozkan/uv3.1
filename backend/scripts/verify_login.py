import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.core import security

async def verify():
    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_username("admin")
        
        if not user:
            print("User 'admin' NOT FOUND in database.")
            return

        print(f"User found: ID={user.id}, Username={user.username}")
        print(f"Stored Hash: {user.hashed_password}")
        
        is_valid = security.verify_password("admin", user.hashed_password)
        print(f"Password 'admin' verification result: {is_valid}")
        
        if not is_valid:
            # Try debugging why
            print("Trying to generate new hash for 'admin' and compare...")
            new_hash = security.get_password_hash("admin")
            print(f"New Hash: {new_hash}")
            print(f"Verify new hash: {security.verify_password('admin', new_hash)}")

if __name__ == "__main__":
    asyncio.run(verify())
