import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.audit_service import AuditService

@pytest.mark.asyncio
async def test_audit_service_pii_redaction():
    mock_db = AsyncMock()
    
    # Details containing PII
    pii_details = {
        "status": "success",
        "ad": "Gizli",
        "soyad": "Kullanici",
        "tc_kimlik": "12345678901",
        "email": "test@example.com",
        "birth_date": "1990-01-01",
        "credit_card": "1234-5678-9012-3456",
        "other_info": "Safe"
    }
    
    await AuditService.log(
        db=mock_db,
        action="TEST_ACTION",
        user_id=1,
        details=pii_details
    )
    
    # Check what was added to DB
    added_obj = mock_db.add.call_args[0][0]
    details = added_obj.details
    
    assert details["status"] == "success"
    assert details["other_info"] == "Safe"
    
    # These should be redacted
    assert details["ad"] == "[REDACTED]"
    assert details["soyad"] == "[REDACTED]"
    assert details["tc_kimlik"] == "[REDACTED]"
    assert details["email"] == "[REDACTED]"
    assert details["birth_date"] == "[REDACTED]"
    assert details["credit_card"] == "[REDACTED]"
