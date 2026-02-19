import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def check_db():
    async with SessionLocal() as session:
        # Check schemas
        res = await session.execute(text("SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('patient', 'clinical', 'finance')"))
        print("Existing Schemas:", [row[0] for row in res.fetchall()])
        
        # Check tables in those schemas
        tables = [
            ("patient", "sharded_patient_demographics"),
            ("clinical", "sharded_clinical_muayeneler"),
            ("clinical", "sharded_clinical_operasyonlar"),
            ("finance", "sharded_finance_islemler")
        ]
        
        for schema, table in tables:
            try:
                # Count total
                res_total = await session.execute(text(f"SELECT COUNT(*) FROM {schema}.{table}"))
                total = res_total.scalar()
                
                # Count active
                res_active = await session.execute(text(f"SELECT COUNT(*) FROM {schema}.{table} WHERE is_deleted = False"))
                active = res_active.scalar()
                
                print(f"✅ {schema}.{table}: {total} total, {active} active")
            except Exception as e:
                print(f"❌ {schema}.{table}: Error: {str(e).splitlines()[0]}")

if __name__ == "__main__":
    asyncio.run(check_db())
