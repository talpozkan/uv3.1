"""PDF Lab Parser Service - Extract lab results from PDF documents."""

import re
from typing import List, Optional
from pydantic import BaseModel

# PyMuPDF (fitz) for PDF text extraction - REQUIRED
try:
    import fitz  # PyMuPDF
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False


class PDFLabResult(BaseModel):
    test_name: str
    value: str
    unit: Optional[str] = None
    reference: Optional[str] = None


class PDFLabParserResponse(BaseModel):
    success: bool
    message: str
    report_date: Optional[str] = None
    results: List[PDFLabResult] = []
    raw_text: Optional[str] = None  # For debugging


class PDFLabParserService:
    """Service to extract lab results from PDF files."""

    # Known test patterns - longer patterns first for better matching
    TEST_PATTERNS = [
        # Multi-line test names (these need special handling)
        (r'^TOTAL PSA \(Prostat$', 'TOTAL PSA'),
        (r'^FREE PSA \(Prostat Spesifik$', 'SERBEST PSA'),
        # Tests with inline values
        (r'^TSH \(Tiroid Stimülan Hormon\)\s*(\d+[.,]?\d*)?$', 'TSH'),
        # Hormone tests
        (r'^SERBEST TESTOSTERON$', 'SERBEST TESTOSTERON'),
        (r'^TOTAL TESTOSTERON$', 'TOTAL TESTOSTERON'),
        (r'^TSH$', 'TSH'),
        (r'^PROLAKTİN$', 'PROLAKTİN'),
        (r'^LH$', 'LH'),
        (r'^FSH$', 'FSH'),
        (r'^ESTRADIOL$', 'ESTRADIOL'),
        (r'^PROGESTERON$', 'PROGESTERON'),
        (r'^SERBEST T3$', 'SERBEST T3'),
        (r'^SERBEST T4$', 'SERBEST T4'),
        (r'^PTH$', 'PTH'),
        # PSA
        (r'^TOTAL PSA$', 'TOTAL PSA'),
        (r'^SERBEST PSA$', 'SERBEST PSA'),
        (r'^FREE PSA$', 'SERBEST PSA'),
        # Vitamins
        (r'^FOLİK ASİT \(Folat\)$', 'FOLAT'),
        (r'^FOLAT$', 'FOLAT'),
        (r'^VİTAMİN D$', 'VİTAMİN D'),
        (r'^25-OH VİTAMİN D$', 'VİTAMİN D'),
        (r'^VİTAMİN B12$', 'VİTAMİN B12'),
        (r'^B12 VİTAMİNİ$', 'VİTAMİN B12'),
        # Glucose/Diabetes
        (r'^HbA1C$', 'HBA1C'),
        (r'^HBA1C$', 'HBA1C'),
        (r'^GLUKOZ$', 'GLUKOZ'),
        (r'^AÇLIK GLUKOZU$', 'GLUKOZ'),
        # Infection markers
        (r'^ANTİ HIV$', 'ANTİ HIV'),
        (r'^ANTI-HIV$', 'ANTİ HIV'),
        (r'^HBsAg$', 'HBsAg'),
        (r'^ANTİ HCV$', 'ANTİ HCV'),
        (r'^ANTİ HBs$', 'ANTİ HBs'),
        (r'^CRP$', 'CRP'),
        (r'^SEDİMANTASYON$', 'SEDİMANTASYON'),
        # Minerals
        (r'^FOSFOR$', 'FOSFOR'),
        (r'^MAGNEZYUM$', 'MAGNEZYUM'),
        (r'^ÇİNKO$', 'ÇİNKO'),
        (r'^SODYUM$', 'SODYUM'),
        (r'^POTASYUM$', 'POTASYUM'),
        (r'^KLOR$', 'KLOR'),
        (r'^KALSİYUM$', 'KALSİYUM'),
        (r'^DEMİR$', 'DEMİR'),
        (r'^FERRİTİN$', 'FERRİTİN'),
        # Kidney
        (r'^ÜRE$', 'ÜRE'),
        (r'^KREATİNİN$', 'KREATİNİN'),
        (r'^eGFR$', 'eGFR'),
        (r'^ÜRİK ASİT$', 'ÜRİK ASİT'),
        # Liver
        (r'^AST$', 'AST'),
        (r'^ALT$', 'ALT'),
        (r'^GGT$', 'GGT'),
        (r'^ALP$', 'ALP'),
        (r'^LDH$', 'LDH'),
        (r'^TOTAL BİLİRUBİN$', 'TOTAL BİLİRUBİN'),
        (r'^DİREKT BİLİRUBİN$', 'DİREKT BİLİRUBİN'),
        (r'^İNDİREKT BİLİRUBİN$', 'İNDİREKT BİLİRUBİN'),
        (r'^ALBÜMİN$', 'ALBÜMİN'),
        (r'^TOTAL PROTEİN$', 'TOTAL PROTEİN'),
        # Lipids
        (r'^TOTAL KOLESTEROL$', 'TOTAL KOLESTEROL'),
        (r'^LDL KOLESTEROL$', 'LDL'),
        (r'^HDL KOLESTEROL$', 'HDL'),
        (r'^TRİGLİSERİD$', 'TRİGLİSERİD'),
        (r'^VLDL$', 'VLDL'),
        # Hemogram
        (r'^WBC$', 'WBC'),
        (r'^RBC$', 'RBC'),
        (r'^HGB$', 'HGB'),
        (r'^HCT$', 'HCT'),
        (r'^PLT$', 'PLT'),
        (r'^MCV$', 'MCV'),
        (r'^MCH$', 'MCH'),
        (r'^MCHC$', 'MCHC'),
        (r'^RDW$', 'RDW'),
        (r'^MPV$', 'MPV'),
        (r'^NÖTROFİL$', 'NÖTROFİL'),
        (r'^LENFOSİT$', 'LENFOSİT'),
        (r'^MONOSİT$', 'MONOSİT'),
        (r'^EOZİNOFİL$', 'EOZİNOFİL'),
        (r'^BAZOFİL$', 'BAZOFİL'),
        # Coagulation
        (r'^INR$', 'INR'),
        (r'^PT$', 'PT'),
        (r'^APTT$', 'APTT'),
        (r'^FİBRİNOJEN$', 'FİBRİNOJEN'),
        (r'^D-DİMER$', 'D-DİMER'),
        # Enzymes
        (r'^AMİLAZ$', 'AMİLAZ'),
        (r'^LİPAZ$', 'LİPAZ'),
        # Urinalysis
        (r'^ERİTROSİT$', 'İDRAR ERİTROSİT'),
        (r'^BİLİRUBİN$', 'İDRAR BİLİRUBİN'),
        (r'^UROBİLİNOJEN$', 'ÜROBİLİNOJEN'),
        (r'^KETON$', 'İDRAR KETON'),
        (r'^PROTEİN$', 'İDRAR PROTEİN'),
        (r'^NİTRİT$', 'İDRAR NİTRİT'),
        (r'^pH$', 'İDRAR pH'),
        (r'^DANSİTE$', 'İDRAR DANSİTE'),
        (r'^LÖKOSİT$', 'İDRAR LÖKOSİT'),
        (r'^MİKROSKOPİ$', None),  # Section header, skip
        (r'^LOKOSİT$', 'MİKRO LÖKOSİT'),
    ]
    
    # Lines to skip
    SKIP_PATTERNS = [
        r'^MERKEZ LABORATUVAR$',
        r'^Tetkik İsteyen',
        r'^DR\.',
        r'^İşlem :$',
        r'^Numune',
        r'^Uzman Onay',
        r'^BİYOKİMYA$',
        r'^SERUM$',
        r'^TAM KAN$',
        r'^İDRAR$',
        r'^HORMON',
        r'^TAM İDRAR',
        r'^Tetkik Adı$',
        r'^Sonuç$',
        r'^Dur\. Birim$',
        r'^Ref\.',
        r'^\d{2}\.\d{2}\.\d{4}',  # Dates
        r'^ÖZEL$',
        r'^KOCAELİ',
        r'^TIBBI LABORATUVAR',
        r'^Laboratuvar Ruhsat',
        r'^Hastanın',
        r'^TC Kimlik',
        r'^Doğum',
        r'^Protokol',
        r'^Rapor Numarası',
        r'^Sicil',
        r'^Pasaport',
        r'Biyokimya.*Uzman',
        r'^MM\d+',
        r'^Bu rapor',
        r'^Revizyon',
        r'^\d+ / \d+$',
        r'^Tel :',
        r'^Fax:',
        r'^Web :',
        r'^E-Posta',
        r'^\[',  # [IP:...] etc
        r'^Spesifik Antijen',  # Continuation of TOTAL PSA
        r'^Antijen Free\)',  # Continuation of FREE PSA
    ]

    @classmethod
    def extract_text_from_pdf(cls, pdf_bytes: bytes) -> str:
        """Extract text from PDF bytes using PyMuPDF."""
        if not PDF_SUPPORT:
            raise ImportError(
                "PyMuPDF (fitz) is required for PDF parsing. "
                "Install with: pip install PyMuPDF"
            )
        
        text = ""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
        return text


    @classmethod
    def find_date(cls, text: str) -> Optional[str]:
        """Extract report date from text."""
        patterns = [
            r'(\d{2})\.(\d{2})\.(\d{4})',  # DD.MM.YYYY
            r'(\d{2})/(\d{2})/(\d{4})',    # DD/MM/YYYY
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                d, m, y = match.groups()
                return f"{y}-{m}-{d}"
        return None

    @classmethod
    def should_skip(cls, line: str) -> bool:
        """Check if line should be skipped."""
        for pattern in cls.SKIP_PATTERNS:
            if re.match(pattern, line, re.IGNORECASE):
                return True
        return False

    @classmethod
    def match_test(cls, line: str) -> tuple:
        """Try to match line as a test name. Returns (test_name, inline_value) or (None, None)."""
        for pattern, test_name in cls.TEST_PATTERNS:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                # Check if there's an inline value (like "TSH (Tiroid...) 1")
                inline_value = None
                if match.lastindex and match.lastindex >= 1:
                    inline_value = match.group(1)
                return (test_name, inline_value)
        return (None, None)

    @classmethod
    def is_numeric_value(cls, s: str) -> bool:
        """Check if string is a numeric value."""
        s = s.strip().replace(',', '.').replace(' ', '')
        try:
            float(s)
            return True
        except:
            pass
        # Qualitative values
        qual = s.lower()
        return qual in ['negatif', 'pozitif', 'normal', 'reaktif', 'non-reaktif']

    @classmethod
    def is_unit(cls, s: str) -> bool:
        """Check if string is a unit."""
        units = [
            'mg/dl', 'mg/l', 'g/dl', 'g/l', 'µg/dl', 'ug/dl', 'ng/ml', 'ng/dl',
            'pg/dl', 'pg/ml', 'µiu/ml', 'uiu/ml', 'miu/ml', 'iu/ml', 'u/l',
            '%', 'mmol/l', 'µmol/l', 'umol/l', 'meq/l', 's/co', 'ul', 'hpf',
            'mm/saat', 'fl', 'pg', 'k/ul', '10^3/ul', '10^6/ul', 'ratio'
        ]
        s_low = s.lower().strip()
        return s_low in units or any(u == s_low for u in units)

    @classmethod
    def is_reference(cls, s: str) -> bool:
        """Check if string is a reference range."""
        # Contains dash between numbers or comparison operators
        if re.search(r'\d+[.,]?\d*\s*-\s*\d+[.,]?\d*', s):
            return True
        if re.match(r'^[<>]?\s*\d', s):
            return True
        return False

    @classmethod
    def is_flag(cls, s: str) -> bool:
        """Check if string is a flag (Y, D, etc.)."""
        return len(s) == 1 and s.isupper()

    @classmethod
    def parse_lab_lines(cls, text: str) -> List[PDFLabResult]:
        """Parse lab results from text lines."""
        results = []
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Skip known non-test lines
            if cls.should_skip(line):
                i += 1
                continue
            
            # Try to match as a test
            test_name, inline_value = cls.match_test(line)
            
            if test_name:
                value = inline_value
                unit = None
                reference = None
                
                # Look ahead for value, unit, reference (next 4 lines max)
                j = i + 1
                lookahead = 0
                max_lookahead = 4
                
                while j < len(lines) and lookahead < max_lookahead:
                    next_line = lines[j].strip()
                    
                    # Stop if next line is another test
                    next_test, _ = cls.match_test(next_line)
                    if next_test:
                        break
                    
                    # Skip continuation lines (like "Spesifik Antijen Total)")
                    if cls.should_skip(next_line):
                        j += 1
                        lookahead += 1
                        continue
                    
                    # Try to classify the line
                    if cls.is_numeric_value(next_line) and not value:
                        value = next_line
                    elif cls.is_flag(next_line):
                        # Just a flag like Y, D - skip it
                        pass
                    elif cls.is_unit(next_line) and not unit:
                        unit = next_line
                    elif cls.is_reference(next_line) and not reference:
                        reference = next_line
                    elif value and not unit and len(next_line) < 15:
                        # Could be unit
                        unit = next_line
                    
                    j += 1
                    lookahead += 1
                
                if value:
                    results.append(PDFLabResult(
                        test_name=test_name,
                        value=value,
                        unit=unit,
                        reference=reference
                    ))
                
                i = j
            else:
                i += 1
        
        return results

    @classmethod
    def parse_pdf(cls, pdf_bytes: bytes) -> PDFLabParserResponse:
        """Main method to parse lab PDF and extract results."""
        
        if not PDF_SUPPORT:
            return PDFLabParserResponse(
                success=False,
                message="PyMuPDF is required for PDF parsing. Install with: pip install PyMuPDF"
            )
        
        try:
            text = cls.extract_text_from_pdf(pdf_bytes)
        except Exception as e:
            return PDFLabParserResponse(
                success=False,
                message=f"PDF text extraction failed: {str(e)}"
            )
        
        if not text or len(text.strip()) < 10:
            return PDFLabParserResponse(
                success=False,
                message="PDF içeriği okunamadı veya boş."
            )
        
        report_date = cls.find_date(text)
        results = cls.parse_lab_lines(text)
        
        # Remove duplicates
        seen = set()
        unique_results = []
        for r in results:
            if r.test_name not in seen:
                seen.add(r.test_name)
                unique_results.append(r)
        
        if not unique_results:
            return PDFLabParserResponse(
                success=False,
                message="PDF'de tanınabilir lab sonucu bulunamadı.",
                report_date=report_date,
                results=[],
                raw_text=text[:2000]
            )
        
        return PDFLabParserResponse(
            success=True,
            message=f"{len(unique_results)} adet lab sonucu bulundu.",
            report_date=report_date,
            results=unique_results
        )
