from typing import Any
from sqlalchemy.orm import DeclarativeBase, declared_attr

class Base(DeclarativeBase):
    id: Any
    __name__: str

    # Tablo ismini sınıf isminden otomatik üret (CamelCase -> snake_case çevirici eklenebilir ama şimdilik lowercase)
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s" # Basit çoğul eki
