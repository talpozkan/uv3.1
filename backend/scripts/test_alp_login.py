import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Ensure models are loaded to avoid Mapper errors
import app.models # This now includes ShardedPatientDemographics

from app.db.session import SessionLocal
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.core import security

async def verify():
    email = "alp@urolog.net.tr"
    password = "temp_pass_123"
    
    print(f"--- Login Verification for: {email} ---")
    
    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        # Try finding by email
        user = await user_repo.get_by_email(email)
        
        if not user:
            print(f"❌ User '{email}' NOT FOUND in database.")
            return

        print(f"✅ User found: ID={user.id}, Username={user.username}, Email={user.email}")
        
        # Verify password using security module
        is_valid = security.verify_password(password, user.hashed_password)
        print(f"Password '{password}' verification result: {'✅ OK' if is_valid else '❌ FAIL'}")
        
        if is_valid:
            print("Successfully verified login credentials logic.")
            
            # Test full authentication service
            auth_service = AuthService(user_repo)
            try:
                tokens = await auth_service.authenticate_user(email, password)
                print("✅ AuthService.authenticate_user: SUCCESS")
                print(f"Tokens generated: {list(tokens.keys())}")
            except Exception as e:
                print(f"❌ AuthService.authenticate_user: ERROR: {e}")
        else:
            print(f"Stored Hash: {user.hashed_password}")

if __name__ == "__main__":
    asyncio.run(verify())
