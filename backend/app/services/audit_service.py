from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogCreate
import json
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal

# Sensitive keys that should NEVER be logged
REDACTED_KEYS = {
    # Turkish keys
    "ad", "soyad", "tc", "tc_kimlik", "email", "telefon", "cep_tel", 
    "ev_tel", "is_tel", "adres", "dogum_tarihi", "sifre", "parola",
    # English equivalents and common security keys
    "first_name", "last_name", "surname", "ssn", "phone", "mobile",
    "address", "birth_date", "password", "secret", "token", "auth",
    "cvv", "credit_card", "iban"
}

def serialize_for_json(obj, key=None):
    """Convert non-JSON-serializable objects to serializable format and redact PII."""
    if obj is None:
        return None
        
    # Redact PII based on key name
    if key and key.lower() in REDACTED_KEYS:
        return "[REDACTED]"
        
    if isinstance(obj, dict):
        return {k: serialize_for_json(v, key=k) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [serialize_for_json(item) for item in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return obj.decode('utf-8', errors='ignore')
    # For any other type, try str conversion
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)

class AuditService:
    @staticmethod
    async def log(
        db: AsyncSession,
        action: str,
        user_id: int | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        details: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None
    ) -> AuditLog:
        """
        even if the main transaction fails.
        """
        # Skip audit if user is configured to skip
        if user_id:
             # We need to fetch user to check skip_audit flag? 
             # Or caller should have checked?
             # Ideally fetch user here or pass user object. 
             # Given async session 'db', we can fetch.
             try:
                 from app.models.user import User
                 from sqlalchemy import select
                 user_res = await db.execute(select(User).filter(User.id == user_id))
                 user = user_res.scalars().first()
                 if user and user.skip_audit:
                     return None
             except Exception:
                 pass # Validation might fail if not in transaction, proceed logging safely

        try:
            # Serialize details to ensure all values are JSON-serializable
            serialized_details = serialize_for_json(details) if details else None
            
            audit_log = AuditLog(
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id else None,
                details=serialized_details,
                ip_address=ip_address,
                user_agent=user_agent
            )
            db.add(audit_log)
            # Use flush instead of commit to ensure ID generation/validation
            # but leave the final commit to the caller's transaction manager.
            # This prevents accidental partial commits of incomplete transactions.
            await db.flush()
            return audit_log
        except Exception as e:
            # Soft-failure: Log the error but don't rollback the main session.
            # Rollback here would destroy the caller's work.
            print(f"[AUDIT] Failed to create audit log: {e}")
            return None
