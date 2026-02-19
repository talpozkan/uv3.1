from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, extract, distinct, union_all, or_, case, cast, String
from datetime import date, timedelta, datetime
from typing import List, Dict, Any, Optional

from app.repositories.patient.models import ShardedPatientDemographics
from app.repositories.clinical.models import ShardedOperasyon, ShardedMuayene, ShardedClinicalNote
from app.repositories.finance.models import ShardedFinansIslem
from app.models.appointment import Randevu
from app.schemas.report import (
    DashboardKPI, ChartDataPoint, PerformanceKPI, HeatmapData,
    CohortRow, DiagnosisFilterResult, DiagnosisTrendPoint, DiagnosisStats,
    ReferenceCategory, ServiceDistribution
)

# Reference category mappings
REFERENCE_CATEGORIES = {
    "hekim": {
        "label": "Hekim Referansı",
        "keywords": ["dr.", "dr ", "doktor", "hekim", "uzman", "prof.", "doç.", "yrd.doç.", "op.dr.", "pratisyen"]
    },
    "hasta": {
        "label": "Hasta Referansı",
        "keywords": ["hasta", "tanıdık", "arkadaş", "akraba", "aile", "komşu", "tavsiye", "öneri"]
    },
    "dijital": {
        "label": "Dijital/Akademik",
        "keywords": ["web", "internet", "google", "makale", "yayın", "sosyal medya", "instagram", "facebook", "twitter", "youtube", "linkedin"]
    }
}

# Service/Subspecialty mappings based on diagnosis codes and keywords
SERVICE_MAPPINGS = {
    "Üroonkoloji": ["C61", "C67", "C64", "C65", "C66", "C68", "D41", "tümör", "kanser", "onko", "malign"],
    "Androloji": ["N48", "N49", "N50", "erekti", "impotans", "infertil", "varikosel", "peyronie", "libido"],
    "Taş Hastalığı": ["N20", "N21", "N22", "N23", "taş", "ürolitiyaz", "nefrolitiyaz", "ESWL", "URS", "PCNL"],
    "Prostat": ["N40", "N41", "N42", "BPH", "prostat", "TURP", "prostatit"],
    "Enfeksiyon": ["N30", "N34", "N39", "sistit", "üretrit", "piyelonefrit", "enfeksiyon", "idrar yolu"],
    "Ürodinamik": ["N31", "N32", "N39.3", "N39.4", "inkontinans", "aşırı aktif", "nörojenik", "ürodinami"]
}

class ReportRepository:
    
    @staticmethod
    async def get_kpis(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None) -> DashboardKPI:
        today = date.today()
        if not start_date:
            start_date = date(today.year, today.month, 1)
        if not end_date:
            end_date = today

        # 1. Total Patients (Always Global)
        res_total = await db.execute(select(func.count(ShardedPatientDemographics.id)))
        total_patients = res_total.scalar() or 0
        
        # 2. New Patients In Period
        res_new = await db.execute(
            select(func.count(ShardedPatientDemographics.id)).where(and_(
                ShardedPatientDemographics.created_at >= datetime.combine(start_date, datetime.min.time()),
                ShardedPatientDemographics.created_at <= datetime.combine(end_date, datetime.max.time())
            ))
        )
        new_patients = res_new.scalar() or 0
        
        # 3. Operations In Period
        res_ops = await db.execute(
            select(func.count(ShardedOperasyon.id)).where(and_(
                ShardedOperasyon.tarih >= start_date,
                ShardedOperasyon.tarih <= end_date
            ))
        )
        ops_count = res_ops.scalar() or 0
        
        # 4. Revenue In Period
        res_rev_curr = await db.execute(
            select(func.sum(ShardedFinansIslem.net_tutar)).where(
                and_(
                    ShardedFinansIslem.tarih >= datetime.combine(start_date, datetime.min.time()),
                    ShardedFinansIslem.tarih <= datetime.combine(end_date, datetime.max.time()),
                    ShardedFinansIslem.islem_tipi == 'gelir'
                )
            )
        )
        revenue_current = res_rev_curr.scalar() or 0.0
        
        # Calculate Previous Period for Change
        period_duration = (end_date - start_date).days + 1
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - timedelta(days=period_duration - 1)
        
        res_rev_prev = await db.execute(
            select(func.sum(ShardedFinansIslem.net_tutar)).where(
                and_(
                    ShardedFinansIslem.tarih >= datetime.combine(prev_start, datetime.min.time()),
                    ShardedFinansIslem.tarih <= datetime.combine(prev_end, datetime.max.time()),
                    ShardedFinansIslem.islem_tipi == 'gelir'
                )
            )
        )
        revenue_prev = res_rev_prev.scalar() or 0.0
        
        rev_change = 0.0
        if revenue_prev > 0:
            rev_change = ((float(revenue_current) - float(revenue_prev)) / float(revenue_prev)) * 100
            
        return DashboardKPI(
            total_patients=total_patients,
            new_patients_month=new_patients,
            total_operations_month=ops_count,
            monthly_revenue=float(revenue_current),
            monthly_revenue_change=round(rev_change, 1)
        )

    @staticmethod
    async def get_performance_kpis(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None) -> PerformanceKPI:
        today = date.today()
        if not start_date:
            start_date = date(today.year, today.month, 1)
        if not end_date:
            end_date = today

        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        # 1. Randevu Sadakat Oranı (Appointment Loyalty)
        res_total_appts = await db.execute(
            select(func.count(Randevu.id)).where(and_(
                Randevu.start >= start_dt,
                Randevu.start <= end_dt,
                Randevu.is_deleted == 0,
                Randevu.type != 'BLOCKED'
            ))
        )
        total_appointments = res_total_appts.scalar() or 0

        res_completed = await db.execute(
            select(func.count(Randevu.id)).where(and_(
                Randevu.start >= start_dt,
                Randevu.start <= end_dt,
                Randevu.is_deleted == 0,
                Randevu.status == 'completed'
            ))
        )
        completed_appointments = res_completed.scalar() or 0

        res_noshow = await db.execute(
            select(func.count(Randevu.id)).where(and_(
                Randevu.start >= start_dt,
                Randevu.start <= end_dt,
                Randevu.is_deleted == 0,
                or_(Randevu.status == 'cancelled', Randevu.status == 'unreachable')
            ))
        )
        no_show_appointments = res_noshow.scalar() or 0

        # Loyalty = (Total - NoShow) / Total
        # This considers 'scheduled', 'confirmed' and 'completed' as loyal (patient didn't cancel)
        loyal_appointments = total_appointments - no_show_appointments
        appointment_loyalty_rate = (loyal_appointments / total_appointments * 100) if total_appointments > 0 else 0.0

        # 2. İşlem Yoğunluğu (Procedure Intensity)
        res_exam_count = await db.execute(
            select(func.count(ShardedMuayene.id)).where(and_(
                ShardedMuayene.tarih >= start_date,
                ShardedMuayene.tarih <= end_date
            ))
        )
        exam_count = res_exam_count.scalar() or 0

        res_procedure_count = await db.execute(
            select(func.count(ShardedOperasyon.id)).where(and_(
                ShardedOperasyon.tarih >= start_date,
                ShardedOperasyon.tarih <= end_date
            ))
        )
        procedure_count = res_procedure_count.scalar() or 0

        total_activity = exam_count + procedure_count
        procedure_ratio = (procedure_count / total_activity * 100) if total_activity > 0 else 0.0

        # 3. Hasta Başına Ortalama Değer
        res_revenue = await db.execute(
            select(func.sum(ShardedFinansIslem.net_tutar)).where(and_(
                ShardedFinansIslem.tarih >= start_dt,
                ShardedFinansIslem.tarih <= end_dt,
                ShardedFinansIslem.islem_tipi == 'gelir'
            ))
        )
        total_revenue = res_revenue.scalar() or 0.0

        res_unique_patients = await db.execute(
            select(func.count(distinct(ShardedFinansIslem.hasta_id))).where(and_(
                ShardedFinansIslem.tarih >= start_dt,
                ShardedFinansIslem.tarih <= end_dt,
                ShardedFinansIslem.islem_tipi == 'gelir'
            ))
        )
        unique_patients = res_unique_patients.scalar() or 0
        avg_revenue_per_patient = (float(total_revenue) / unique_patients) if unique_patients > 0 else 0.0

        # 4. Geri Dönüş Oranı (Return Rate)
        # Patients with more than 1 examination
        first_exams = select(
            ShardedMuayene.hasta_id,
            func.min(ShardedMuayene.tarih).label("first_date")
        ).group_by(ShardedMuayene.hasta_id).subquery()

        # First-time patients in period
        res_first_time = await db.execute(
            select(func.count(first_exams.c.hasta_id)).where(and_(
                first_exams.c.first_date >= start_date,
                first_exams.c.first_date <= end_date
            ))
        )
        first_time_patients = res_first_time.scalar() or 0

        # Patients with multiple exams (returning patients)
        exam_counts = select(
            ShardedMuayene.hasta_id,
            func.count(ShardedMuayene.id).label("exam_count")
        ).where(and_(
            ShardedMuayene.tarih >= start_date,
            ShardedMuayene.tarih <= end_date
        )).group_by(ShardedMuayene.hasta_id).subquery()

        res_returning = await db.execute(
            select(func.count(exam_counts.c.hasta_id)).where(exam_counts.c.exam_count > 1)
        )
        returning_patients = res_returning.scalar() or 0

        total_patients_with_exams = first_time_patients + returning_patients
        return_rate = (returning_patients / total_patients_with_exams * 100) if total_patients_with_exams > 0 else 0.0

        return PerformanceKPI(
            appointment_loyalty_rate=round(appointment_loyalty_rate, 1),
            total_appointments=total_appointments,
            completed_appointments=completed_appointments,
            no_show_appointments=no_show_appointments,
            exam_count=exam_count,
            procedure_count=procedure_count,
            procedure_ratio=round(procedure_ratio, 1),
            avg_revenue_per_patient=round(avg_revenue_per_patient, 2),
            return_rate=round(return_rate, 1),
            returning_patients=returning_patients,
            first_time_patients=first_time_patients
        )

    @staticmethod
    async def get_heatmap_data(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[HeatmapData]:
        today = date.today()
        if not start_date:
            start_date = today - timedelta(days=90)
        if not end_date:
            end_date = today

        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        # Get appointments grouped by day of week and hour
        res = await db.execute(
            select(
                extract('dow', Randevu.start).label('day'),  # 0=Sunday in PostgreSQL
                extract('hour', Randevu.start).label('hour'),
                func.count(Randevu.id).label('count')
            ).where(and_(
                Randevu.start >= start_dt,
                Randevu.start <= end_dt,
                Randevu.is_deleted == 0,
                Randevu.type != 'BLOCKED'
            )).group_by('day', 'hour')
        )
        rows = res.all()

        # Convert PostgreSQL DOW (0=Sunday) to our format (0=Monday)
        data = []
        for row in rows:
            pg_dow = int(row[0])  # PostgreSQL: 0=Sunday, 1=Monday, ..., 6=Saturday
            # Convert to 0=Monday, ..., 6=Sunday
            our_dow = (pg_dow - 1) % 7 if pg_dow > 0 else 6
            data.append(HeatmapData(
                day=our_dow,
                hour=int(row[1]),
                value=int(row[2])
            ))

        return data

    @staticmethod
    async def get_cohort_analysis(db: AsyncSession, months_back: int = 6) -> List[CohortRow]:
        today = date.today()
        cohorts = []

        for i in range(months_back, -1, -1):
            # Calculate cohort month
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1
            cohort_start = date(year, month, 1)
            
            ny, nm = (year, month + 1) if month < 12 else (year + 1, 1)
            cohort_end = date(ny, nm, 1)

            # Get patients who had their first exam in this cohort month
            first_exams = select(
                ShardedMuayene.hasta_id,
                func.min(ShardedMuayene.tarih).label("first_date")
            ).group_by(ShardedMuayene.hasta_id).subquery()

            res_cohort = await db.execute(
                select(first_exams.c.hasta_id).where(and_(
                    first_exams.c.first_date >= cohort_start,
                    first_exams.c.first_date < cohort_end
                ))
            )
            cohort_patients = [row[0] for row in res_cohort.all()]
            total_patients = len(cohort_patients)

            if total_patients == 0:
                cohorts.append(CohortRow(
                    cohort_month=cohort_start.strftime("%Y-%m"),
                    total_patients=0,
                    month_0=0, month_1=0, month_2=0, month_3=0, month_4=0, month_5=0, month_6=0
                ))
                continue

            # Track retention for each subsequent month
            retention = [total_patients]  # month_0 is always 100%
            for m in range(1, 7):
                # Check how many cohort patients had activity m months later
                check_year = year
                check_month = month + m
                while check_month > 12:
                    check_month -= 12
                    check_year += 1
                check_start = date(check_year, check_month, 1)
                cny, cnm = (check_year, check_month + 1) if check_month < 12 else (check_year + 1, 1)
                check_end = date(cny, cnm, 1)

                if check_start > today:
                    retention.append(0)
                    continue

                # Count patients from cohort who had any activity in this month
                # Use label() to ensure column name is preserved in subquery/union
                m_activity = select(distinct(ShardedMuayene.hasta_id).label("hasta_id")).where(and_(
                    ShardedMuayene.hasta_id.in_(cohort_patients),
                    ShardedMuayene.tarih >= check_start,
                    ShardedMuayene.tarih < check_end
                ))
                n_activity = select(distinct(ShardedClinicalNote.hasta_id).label("hasta_id")).where(and_(
                    ShardedClinicalNote.hasta_id.in_(cohort_patients),
                    ShardedClinicalNote.tarih >= check_start,
                    ShardedClinicalNote.tarih < check_end
                ))
                combined = union_all(m_activity, n_activity).subquery()
                
                res_active = await db.execute(select(func.count(distinct(combined.c.hasta_id))))
                active_count = res_active.scalar() or 0
                retention.append(active_count)

            cohorts.append(CohortRow(
                cohort_month=cohort_start.strftime("%Y-%m"),
                total_patients=total_patients,
                month_0=retention[0],
                month_1=retention[1],
                month_2=retention[2],
                month_3=retention[3],
                month_4=retention[4],
                month_5=retention[5],
                month_6=retention[6]
            ))

        return cohorts

    @staticmethod
    async def get_diagnosis_stats(db: AsyncSession, icd_code: Optional[str] = None, diagnosis_text: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None) -> DiagnosisStats:
        today = date.today()
        if not start_date:
            start_date = today - timedelta(days=730)  # Default 2 years
        if not end_date:
            end_date = today

        # Build filter conditions
        conditions = [ShardedMuayene.tarih >= start_date, ShardedMuayene.tarih <= end_date]
        
        if icd_code:
            conditions.append(or_(
                ShardedMuayene.tani1_kodu.ilike(f"%{icd_code}%"),
                ShardedMuayene.tani2_kodu.ilike(f"%{icd_code}%")
            ))
        
        if diagnosis_text:
            conditions.append(or_(
                ShardedMuayene.tani1.ilike(f"%{diagnosis_text}%"),
                ShardedMuayene.tani2.ilike(f"%{diagnosis_text}%")
            ))

        # Get matching patients
        query = select(
            ShardedPatientDemographics.id,
            ShardedPatientDemographics.ad,
            ShardedPatientDemographics.soyad,
            ShardedMuayene.tani1,
            ShardedMuayene.tani1_kodu,
            ShardedMuayene.tarih
        ).join(ShardedPatientDemographics, ShardedMuayene.hasta_id == ShardedPatientDemographics.id).where(and_(*conditions)).order_by(desc(ShardedMuayene.tarih))

        res = await db.execute(query)
        rows = res.all()

        patients = [
            DiagnosisFilterResult(
                id=str(row[0]),
                ad=row[1] or "",
                soyad=row[2] or "",
                tani=row[3] or "",
                tani_kodu=row[4] or "",
                tarih=row[5].isoformat() if row[5] else ""
            ) for row in rows
        ]

        # Calculate total count and percentage of portfolio
        total_count = len(patients)
        
        res_total_patients = await db.execute(select(func.count(distinct(ShardedPatientDemographics.id))))
        total_portfolio = res_total_patients.scalar() or 1
        percentage = (total_count / total_portfolio) * 100

        # Calculate trend (yearly comparison)
        trend = []
        for year_offset in range(2, -1, -1):
            trend_year = today.year - year_offset
            trend_start = date(trend_year, 1, 1)
            trend_end = date(trend_year, 12, 31)
            
            trend_conditions = [ShardedMuayene.tarih >= trend_start, ShardedMuayene.tarih <= trend_end]
            if icd_code:
                trend_conditions.append(or_(
                    ShardedMuayene.tani1_kodu.ilike(f"%{icd_code}%"),
                    ShardedMuayene.tani2_kodu.ilike(f"%{icd_code}%")
                ))
            if diagnosis_text:
                trend_conditions.append(or_(
                    ShardedMuayene.tani1.ilike(f"%{diagnosis_text}%"),
                    ShardedMuayene.tani2.ilike(f"%{diagnosis_text}%")
                ))
            
            res_trend = await db.execute(
                select(func.count(distinct(ShardedMuayene.hasta_id))).where(and_(*trend_conditions))
            )
            trend_count = res_trend.scalar() or 0
            trend.append(DiagnosisTrendPoint(period=str(trend_year), count=trend_count))

        return DiagnosisStats(
            total_count=total_count,
            percentage_of_portfolio=round(percentage, 2),
            trend=trend,
            patients=patients[:100]  # Limit to first 100 patients
        )

    @staticmethod
    async def get_reference_categories(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[ReferenceCategory]:
        today = date.today()
        if not start_date:
            start_date = date(today.year, today.month, 1)
        if not end_date:
            end_date = today

        # Get all references with counts
        query = select(ShardedPatientDemographics.referans, func.count(distinct(ShardedPatientDemographics.id))) \
            .join(ShardedMuayene, ShardedPatientDemographics.id == ShardedMuayene.hasta_id) \
            .where(and_(
                ShardedPatientDemographics.referans.isnot(None),
                ShardedPatientDemographics.referans != "",
                ShardedMuayene.tarih >= start_date,
                ShardedMuayene.tarih <= end_date
            )).group_by(ShardedPatientDemographics.referans)
        
        res = await db.execute(query)
        rows = res.all()

        # Categorize references
        categories = {
            "hekim": {"label": "Hekim Referansı", "count": 0, "sources": []},
            "hasta": {"label": "Hasta Referansı", "count": 0, "sources": []},
            "dijital": {"label": "Dijital/Akademik", "count": 0, "sources": []},
            "diger": {"label": "Diğer", "count": 0, "sources": []}
        }

        total_count = sum(row[1] for row in rows)

        for ref_name, count in rows:
            ref_lower = ref_name.lower() if ref_name else ""
            categorized = False
            
            for cat_key, cat_data in REFERENCE_CATEGORIES.items():
                if any(kw in ref_lower for kw in cat_data["keywords"]):
                    categories[cat_key]["count"] += count
                    categories[cat_key]["sources"].append(ChartDataPoint(name=ref_name, value=count))
                    categorized = True
                    break
            
            if not categorized:
                categories["diger"]["count"] += count
                categories["diger"]["sources"].append(ChartDataPoint(name=ref_name, value=count))

        result = []
        for cat_key, cat_data in categories.items():
            if cat_data["count"] > 0:
                result.append(ReferenceCategory(
                    category=cat_key,
                    category_label=cat_data["label"],
                    count=cat_data["count"],
                    percentage=round((cat_data["count"] / total_count * 100) if total_count > 0 else 0, 1),
                    sources=sorted(cat_data["sources"], key=lambda x: x.value, reverse=True)[:10]
                ))

        return sorted(result, key=lambda x: x.count, reverse=True)

    @staticmethod
    async def get_service_distribution(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[ServiceDistribution]:
        today = date.today()
        if not start_date:
            start_date = date(today.year, today.month, 1)
        if not end_date:
            end_date = today

        # Get all diagnoses in period
        query = select(
            ShardedMuayene.tani1,
            ShardedMuayene.tani1_kodu,
            ShardedMuayene.tani2,
            ShardedMuayene.tani2_kodu,
            func.count(ShardedMuayene.id).label('count')
        ).where(and_(
            ShardedMuayene.tarih >= start_date,
            ShardedMuayene.tarih <= end_date
        )).group_by(ShardedMuayene.tani1, ShardedMuayene.tani1_kodu, ShardedMuayene.tani2, ShardedMuayene.tani2_kodu)

        res = await db.execute(query)
        rows = res.all()

        # Categorize by service
        service_counts = {service: 0 for service in SERVICE_MAPPINGS.keys()}
        service_counts["Diğer"] = 0
        total_count = 0

        for row in rows:
            tani1, kod1, tani2, kod2, count = row
            combined_text = f"{tani1 or ''} {kod1 or ''} {tani2 or ''} {kod2 or ''}".lower()
            total_count += count
            categorized = False
            
            for service, keywords in SERVICE_MAPPINGS.items():
                if any(kw.lower() in combined_text for kw in keywords):
                    service_counts[service] += count
                    categorized = True
                    break
            
            if not categorized:
                service_counts["Diğer"] += count

        result = []
        for service, count in service_counts.items():
            if count > 0:
                result.append(ServiceDistribution(
                    name=service,
                    count=count,
                    percentage=round((count / total_count * 100) if total_count > 0 else 0, 1)
                ))

        return sorted(result, key=lambda x: x.count, reverse=True)

    @staticmethod
    async def get_patient_trends(db: AsyncSession, start_date_filter: Optional[date] = None, end_date_filter: Optional[date] = None) -> List[ChartDataPoint]:
        # Monthly activity trend
        if not end_date_filter:
            end_date_filter = date.today()
        if not start_date_filter:
            start_date_filter = end_date_filter - timedelta(days=180) # Default 6 months
            start_date_filter = date(start_date_filter.year, start_date_filter.month, 1)

        data = []
        
        # Combine activity sources
        m_stmt = select(ShardedMuayene.hasta_id, ShardedMuayene.tarih)
        n_stmt = select(ShardedClinicalNote.hasta_id, ShardedClinicalNote.tarih)
        combined_stmt = union_all(m_stmt, n_stmt).alias("combined")
        
        # Get latest activity per patient
        latest_per_patient = select(
            combined_stmt.c.hasta_id,
            func.max(combined_stmt.c.tarih).label("max_tarih")
        ).group_by(combined_stmt.c.hasta_id).subquery()

        # Iterate months
        current = date(start_date_filter.year, start_date_filter.month, 1)
        while current <= end_date_filter:
            next_month_year = current.year + (1 if current.month == 12 else 0)
            next_month_month = 1 if current.month == 12 else current.month + 1
            next_month = date(next_month_year, next_month_month, 1)
            
            res = await db.execute(
                select(func.count(latest_per_patient.c.hasta_id))
                .where(and_(
                    latest_per_patient.c.max_tarih >= current, 
                    latest_per_patient.c.max_tarih < next_month
                ))
            )
            cnt = res.scalar() or 0
            
            month_name = current.strftime("%b %y")
            data.append(ChartDataPoint(name=month_name, value=float(cnt)))
            
            current = next_month
            
        return data

    @staticmethod
    async def get_revenue_chart(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[ChartDataPoint]:
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=180) # Default 6 months
            start_date = date(start_date.year, start_date.month, 1)
            
        data = []
        
        # Iterate months
        current = date(start_date.year, start_date.month, 1)
        while current <= end_date:
            next_month_year = current.year + (1 if current.month == 12 else 0)
            next_month_month = 1 if current.month == 12 else current.month + 1
            next_month = date(next_month_year, next_month_month, 1)
            
            res = await db.execute(select(func.sum(ShardedFinansIslem.net_tutar)).where(
                and_(
                    ShardedFinansIslem.tarih >= datetime.combine(current, datetime.min.time()), 
                    ShardedFinansIslem.tarih < datetime.combine(next_month, datetime.min.time()),
                    ShardedFinansIslem.islem_tipi == 'gelir'
                )
            ))
            amount = res.scalar() or 0.0
            month_name = current.strftime("%b %y")
            data.append(ChartDataPoint(name=month_name, value=float(amount)))
            
            current = next_month
            
        return data

    @staticmethod
    async def get_operation_chart(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[ChartDataPoint]:
        # Top 5 Operations by Count
        query = select(ShardedOperasyon.ameliyat, func.count(ShardedOperasyon.id))
        
        if start_date:
            query = query.where(ShardedOperasyon.tarih >= start_date)
        if end_date:
            query = query.where(ShardedOperasyon.tarih <= end_date)
            
        query = query.group_by(ShardedOperasyon.ameliyat) \
            .order_by(desc(func.count(ShardedOperasyon.id))) \
            .limit(5)
            
        res = await db.execute(query)
        rows = res.all()
        data = []
        for name, count in rows:
            if name:
                data.append(ChartDataPoint(name=name, value=count))
        
        return data

    @staticmethod
    async def get_weekly_new_patients(db: AsyncSession, start_date_filter: Optional[date] = None, end_date_filter: Optional[date] = None) -> List[ChartDataPoint]:
        if not end_date_filter:
            end_date_filter = date.today()
        if not start_date_filter:
            start_date_filter = end_date_filter - timedelta(weeks=8)
            
        # Align start_date to Monday
        start_date = start_date_filter - timedelta(days=start_date_filter.weekday())
        
        # Get first-ever examination date for each patient
        first_exams = select(
            ShardedMuayene.hasta_id,
            func.min(ShardedMuayene.tarih).label("first_date")
        ).group_by(ShardedMuayene.hasta_id).subquery()
        
        data = []
        
        current = start_date
        while current <= end_date_filter:
            next_week = current + timedelta(weeks=1)
            
            res = await db.execute(
                select(func.count(first_exams.c.hasta_id))
                .where(and_(
                    first_exams.c.first_date >= current,
                    first_exams.c.first_date < next_week
                ))
            )
            count = res.scalar() or 0
            
            label = current.strftime("%d %b '%y")
            data.append(ChartDataPoint(name=label, value=float(count)))
            
            current = next_week
            
        return data

    @staticmethod
    async def get_weekly_drilldown(db: AsyncSession, label: str) -> List[Dict[str, Any]]:
        try:
            d = datetime.strptime(label, "%d %b '%y").date()
            start_date = d
            end_date = d + timedelta(days=7)
        except:
            return []

        first_exams = select(
            ShardedMuayene.hasta_id,
            func.min(ShardedMuayene.tarih).label("first_date")
        ).group_by(ShardedMuayene.hasta_id).subquery()

        query = select(ShardedPatientDemographics.id, ShardedPatientDemographics.ad, ShardedPatientDemographics.soyad) \
            .join(first_exams, ShardedPatientDemographics.id == first_exams.c.hasta_id) \
            .where(and_(
                first_exams.c.first_date >= start_date,
                first_exams.c.first_date < end_date
            ))
            
        res = await db.execute(query)
        rows = res.all()
        return [{"id": str(row[0]), "ad": row[1], "soyad": row[2]} for row in rows]

    @staticmethod
    async def get_monthly_drilldown(db: AsyncSession, label: str) -> List[Dict[str, Any]]:
        try:
            # Handle both "%b %y" and "%b '%y" formats
            try:
                d = datetime.strptime(label, "%b %y").date()
            except:
                d = datetime.strptime(label, "%b '%y").date()
            start_date = d
            ny, nm = (d.year, d.month + 1) if d.month < 12 else (d.year + 1, 1)
            end_date = date(ny, nm, 1)
        except:
            return []

        # Combine activity sources for latest activity
        m_stmt = select(ShardedMuayene.hasta_id, ShardedMuayene.tarih)
        n_stmt = select(ShardedClinicalNote.hasta_id, ShardedClinicalNote.tarih)
        combined_stmt = union_all(m_stmt, n_stmt).alias("combined")
        
        latest_per_patient = select(
            combined_stmt.c.hasta_id,
            func.max(combined_stmt.c.tarih).label("max_tarih")
        ).group_by(combined_stmt.c.hasta_id).subquery()

        query = select(ShardedPatientDemographics.id, ShardedPatientDemographics.ad, ShardedPatientDemographics.soyad) \
            .join(latest_per_patient, ShardedPatientDemographics.id == latest_per_patient.c.hasta_id) \
            .where(and_(
                latest_per_patient.c.max_tarih >= start_date,
                latest_per_patient.c.max_tarih < end_date
            ))
            
        res = await db.execute(query)
        rows = res.all()
        return [{"id": str(row[0]), "ad": row[1], "soyad": row[2]} for row in rows]

    @staticmethod
    async def get_reference_stats(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[ChartDataPoint]:
        # Joining with ShardedMuayene to base on examination dates as requested
        query = select(ShardedPatientDemographics.referans, func.count(distinct(ShardedPatientDemographics.id))) \
            .join(ShardedMuayene, ShardedPatientDemographics.id == ShardedMuayene.hasta_id) \
            .where(ShardedPatientDemographics.referans.isnot(None), ShardedPatientDemographics.referans != "")
        
        if start_date:
            query = query.where(ShardedMuayene.tarih >= start_date)
        if end_date:
            query = query.where(ShardedMuayene.tarih <= end_date)
            
        query = query.group_by(ShardedPatientDemographics.referans).order_by(desc(func.count(distinct(ShardedPatientDemographics.id)))).limit(15)
        
        res = await db.execute(query)
        rows = res.all()
        return [ChartDataPoint(name=row[0], value=row[1]) for row in rows]

    @staticmethod
    async def get_reference_patients(db: AsyncSession, referans: str, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
        query = select(ShardedPatientDemographics.id, ShardedPatientDemographics.ad, ShardedPatientDemographics.soyad) \
            .join(ShardedMuayene, ShardedPatientDemographics.id == ShardedMuayene.hasta_id) \
            .where(ShardedPatientDemographics.referans == referans)
            
        if start_date:
            query = query.where(ShardedMuayene.tarih >= start_date)
        if end_date:
            query = query.where(ShardedMuayene.tarih <= end_date)
            
        query = query.group_by(ShardedPatientDemographics.id, ShardedPatientDemographics.ad, ShardedPatientDemographics.soyad).order_by(ShardedPatientDemographics.ad, ShardedPatientDemographics.soyad)
        
        res = await db.execute(query)
        rows = res.all()
        return [{"id": str(row[0]), "ad": row[1], "soyad": row[2]} for row in rows]

    @staticmethod
    async def get_cancellation_stats(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[ChartDataPoint]:
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=90)
            
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
        
        # Query cancelled appointments
        query = select(
            Randevu.cancel_reason, 
            func.count(Randevu.id)
        ).where(and_(
            Randevu.start >= start_dt,
            Randevu.start <= end_dt,
            Randevu.status == 'cancelled'
        )).group_by(Randevu.cancel_reason)
        
        res = await db.execute(query)
        rows = res.all()
        
        data = []
        for reason, count in rows:
            label = reason or "Belirtilmedi"
            data.append(ChartDataPoint(name=label, value=count))
            
        return sorted(data, key=lambda x: x.value, reverse=True)

report_repository = ReportRepository()
