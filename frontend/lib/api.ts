import { useAuthStore } from '@/stores/auth-store';
import { DashboardData } from '@/types/dashboard';

// Always use Next.js proxy to avoid CORS issues
// The proxy is configured in next.config.js to forward /api/v1/* to backend
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE_URL = '';  // Always use proxy (no direct backend connection)
console.log('API_BASE_URL being used:', API_BASE_URL, '(isDev:', isDevelopment, ')');

interface FetchOptions extends RequestInit {
    token?: string;
}

export async function apiFetch<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: HeadersInit = {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
    };

    const storedToken = useAuthStore.getState().token;
    const effectiveToken = token || storedToken;

    if (effectiveToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${effectiveToken}`;
    } else {
        console.warn('apiFetch: No token available for', endpoint);
        console.warn('Auth Store state:', JSON.stringify({
            hasToken: !!useAuthStore.getState().token,
            hasUser: !!useAuthStore.getState().user,
            hydrated: useAuthStore.getState()._hasHydrated
        }));
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
        cache: 'no-store',
    });

    if (!response.ok) {
        if (response.status === 401) {
            const tokenExists = !!useAuthStore.getState().token;
            const tokenPreview = useAuthStore.getState().token?.substring(0, 30) + '...';
            console.error('=== 401 UNAUTHORIZED DEBUG ===');
            console.error('Endpoint:', endpoint);
            console.error('Token exists:', tokenExists);
            console.error('Token preview:', tokenPreview);
            console.error('Request URL:', `${API_BASE_URL}${endpoint}`);
            console.error('Response status:', response.status);
            const errorText = await response.clone().text();
            console.error('Response body:', errorText);
            console.error('===============================');

            // Don't logout for audit or verify-password endpoints - these are behind secure area access
            // and may have timing issues with token refresh or user entering wrong password
            const isSecureEndpoint = endpoint.includes('/audit') || endpoint.includes('/verify-password');

            if (!isSecureEndpoint) {
                // Immediate session expiration trigger
                useAuthStore.getState().triggerSessionExpired();
            }
        }
        const error = await response.text();
        throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json();
}

// Types - (Keeping existing types, just updating endpoint calls below)
export interface Patient {
    id: string;
    tc_kimlik?: string;
    ad: string;
    soyad: string;
    cinsiyet?: string;
    dogum_tarihi?: string;
    dogum_yeri?: string;
    kan_grubu?: string;
    medeni_hal?: string;
    meslek?: string;
    adres?: string;
    ev_tel?: string;
    is_tel?: string;
    cep_tel?: string;
    email?: string;
    kimlik_notlar?: string;
    doktor?: string;
    created_at?: string;
    updated_at?: string;
    son_muayene_tarihi?: string;
    son_tani?: string;

    // New Fields
    referans?: string;
    postakodu?: string;
    kurum?: string;
    sigorta?: string;
    ozelsigorta?: string;
    cocuk_sayisi?: string;
    faks?: string;
    ilce?: string;
    sehir?: string;
    hasta_rec_id?: string;
    telefon_gorusme_sayisi?: number;

    // Visual based new fields
    sms_izin?: string;
    email_izin?: string;
    iletisim_kaynagi?: string;
    iletisim_tercihi?: string;
    indirim_grubu?: string;
    dil?: string;
    personel_ids?: string;
    etiketler?: string;
    kayit_notu?: string;
    protokol_no?: string;
}

export interface PatientReportDTO {
    demographics?: Patient;
    examinations: any[]; // Extended as needed
    lab_results: any[];
    finance_summary?: any;
    warnings: string[];
    generated_at: string;
}

export interface Muayene {
    id: number;
    hasta_id: string;
    tarih?: string;
    sikayet?: string;
    oyku?: string;
    tansiyon?: string;
    ates?: string;
    kvah?: string;
    bobrek_sag?: string;
    bobrek_sol?: string;
    suprapubik_kitle?: string;
    ego?: string;
    rektal_tuse?: string;
    disuri?: string;
    pollakiuri?: string;
    nokturi?: string;
    hematuri?: string;
    genital_akinti?: string;
    kabizlik?: string;
    tas_oyku?: string;
    takip_notu?: string;
    sistem_sorgu?: string;
    ipss_skor?: string;
    iief_ef_skor?: string;
    iief_ef_answers?: string;
    ozgecmis?: string;
    soygecmis?: string;
    kullandigi_ilaclar?: string;
    aliskanliklar?: string;
    fizik_muayene?: string;
    catallanma?: string;
    projeksiyon_azalma?: string;
    kalibre_incelme?: string;
    idrar_bas_zorluk?: string;
    kesik_idrar_yapma?: string;
    terminal_damlama?: string;
    residiv_hissi?: string;
    inkontinans?: string;
    tani?: string;
    tani1?: string;
    tani2?: string;
    tani3?: string;
    tani4?: string;
    tani5?: string;
    sonuc?: string;
    tedavi?: string;
    oneriler?: string;
    erektil_islev?: string;
    ejakulasyon?: string;
    mshq?: string;
    prosedur?: string;
    tani1_kodu?: string;
    tani2_kodu?: string;
    tani3_kodu?: string;
    tani4_kodu?: string;
    tani5_kodu?: string;
    doktor?: string;
    bulgu_notu?: string;
    recete?: string;
    allerjiler?: string;
    kan_sulandirici?: number;
}

export interface PatientCreate {
    ad: string;
    soyad: string;
    tc_kimlik?: string;
    cinsiyet?: string;
    dogum_tarihi?: string;
    dogum_yeri?: string;
    kan_grubu?: string;
    medeni_hal?: string;
    meslek?: string;
    adres?: string;
    ev_tel?: string;
    is_tel?: string;
    cep_tel?: string;
    email?: string;
    kimlik_notlar?: string;
    doktor?: string;

    // New Fields
    referans?: string;
    postakodu?: string;
    kurum?: string;
    sigorta?: string;
    ozelsigorta?: string;
    ocuk_sayisi?: string;
    faks?: string;

    // Visual based new fields
    sms_izin?: string;
    email_izin?: string;
    iletisim_kaynagi?: string;
    iletisim_tercihi?: string;
    indirim_grubu?: string;
    dil?: string;
    personel_ids?: string;
    etiketler?: string;
    kayit_notu?: string;
    protokol_no?: string;
}

export interface MuayeneCreate {
    hasta_id: string;
    tarih?: string;
    sikayet?: string;
    oyku?: string;
    tansiyon?: string;
    ates?: string;
    kvah?: string;
    bobrek_sag?: string;
    bobrek_sol?: string;
    suprapubik_kitle?: string;
    ego?: string;
    rektal_tuse?: string;
    disuri?: string;
    pollakiuri?: string;
    nokturi?: string;
    hematuri?: string;
    genital_akinti?: string;
    kabizlik?: string;
    takip_notu?: string;
    sistem_sorgu?: string;
    ipss_skor?: string;
    iief_ef_skor?: string;
    iief_ef_answers?: string;
    ozgecmis?: string;
    soygecmis?: string;
    kullandigi_ilaclar?: string;
    fizik_muayene?: string;
    catallanma?: string;
    projeksiyon_azalma?: string;
    kalibre_incelme?: string;
    idrar_bas_zorluk?: string;
    kesik_idrar_yapma?: string;
    terminal_damlama?: string;
    residiv_hissi?: string;
    inkontinans?: string;
    tani?: string;
    tani1?: string;
    tani2?: string;
    tani3?: string;
    tani4?: string;
    tani5?: string;
    sonuc?: string;
    tedavi?: string;
    oneriler?: string;
    erektil_islev?: string;
    ejakulasyon?: string;
    mshq?: string;
    prosedur?: string;
    tani1_kodu?: string;
    tani2_kodu?: string;
    tani3_kodu?: string;
    tani4_kodu?: string;
    tani5_kodu?: string;
    doktor?: string;
    bulgu_notu?: string;
    recete?: string;
    allerjiler?: string;
    aliskanliklar?: string;
    kan_sulandirici?: number;
}

export interface TimelineItem {
    id: string;
    date?: string;
    type: string; // appointment, payment, service, operation, examination, lab, imaging, photo, followup, plan, report, phone, document
    title: string;
    description?: string;
    personnel?: string;
    status?: string;
    amount?: number;
    time?: string;
}

export interface AuditLog {
    id: string;
    action: string;
    user_id?: number;
    username?: string;
    resource_type?: string;
    resource_id?: string;
    details?: any;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
}

// API methods
export interface StockProduct {
    id: number;
    urun_adi: string;
    marka?: string;
    urun_tipi?: string;
    birim?: string;
    birim_fiyat?: number;
    mevcut_stok: number;
    min_stok?: number;
    barkod?: string;
    aktif?: boolean;
}

export interface StockProductCreate {
    urun_adi: string;
    marka?: string;
    urun_tipi?: string;
    birim?: string;
    birim_fiyat?: number;
    min_stok?: number;
    barkod?: string;
}

export interface StockMovement {
    id: number;
    urun_id: number;
    hasta_id?: string;
    hareket_tipi: string;
    miktar: number;
    islem_tarihi?: string;
    kaynak?: string;
    kaynak_ref?: string;
    notlar?: string;
    kullanici_id?: number;
    urun_adi?: string;
    hasta_adi?: string;
}

export interface StockPurchase {
    id: number;
    urun_id: number;
    firma_id?: number;
    alim_tarihi?: string;
    miktar: number;
    birim_fiyat: number;
    toplam_tutar: number;
    fatura_no?: string;
    notlar?: string;
}

export interface StockSummary {
    toplam_urun: number;
    toplam_stok_adedi: number;
    toplam_stok_degeri: number;
    dusuk_stoklu_urunler: number;
}

export interface TrusBiyopsi {
    id: number;
    hasta_id: string;
    tarih?: string;
    psa_total?: string;
    rektal_tuse?: string;
    mri_var: boolean;
    mri_tarih?: string;
    mri_ozet?: string;
    lokasyonlar?: string;
    prosedur_notu?: string;
    created_at?: string;
}

export interface TrusBiyopsiCreate {
    hasta_id: string;
    tarih?: string;
    psa_total?: string;
    rektal_tuse?: string;
    mri_var?: boolean;
    mri_tarih?: string;
    mri_ozet?: string;
    lokasyonlar?: string;
    prosedur_notu?: string;
}

export interface LabDataPoint {
    value: number;
    date: string;
    unit: string;
    flag?: string | null;
}

export interface LabTrendResponse {
    test_name: string;
    current_value: number;
    unit: string;
    trend_slope: number;
    is_critical: boolean;
    history: LabDataPoint[];
}

export interface LabTrendRequest {
    patient_id: string;
    test_names: string[];
}

export const api = {
    patients: {
        list: (params?: { skip?: number; limit?: number; search?: string; ad?: string; soyad?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.skip) searchParams.set('skip', String(params.skip));
            if (params?.limit) searchParams.set('limit', String(params.limit));
            if (params?.search) searchParams.set('search', params.search);
            if (params?.ad) searchParams.set('ad', params.ad);
            if (params?.soyad) searchParams.set('soyad', params.soyad);
            return apiFetch<Patient[]>(`/api/v1/patients?${searchParams.toString()}`);
        },
        get: (id: string) => apiFetch<Patient>(`/api/v1/patients/${id}`),
        getById: (id: number) => apiFetch<Patient>(`/api/v1/patients/${id}`),
        getCounts: (id: string) => apiFetch<{
            muayene: number;
            imaging: number;
            operation: number;
            followup: number;
            document: number;
            photo: number;
        }>(`/api/v1/patients/${id}/counts`),
        getTimeline: (id: string) => apiFetch<TimelineItem[]>(`/api/v1/patients/${id}/timeline`),
        create: (data: PatientCreate) =>
            apiFetch<Patient>('/api/v1/patients', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Partial<Patient>) =>
            apiFetch<Patient>(`/api/v1/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) =>
            apiFetch<Patient>(`/api/v1/patients/${id}`, { method: 'DELETE' }),
        getReferences: () =>
            apiFetch<string[]>('/api/v1/patients/references'),
        getReport: (id: string) =>
            apiFetch<PatientReportDTO>(`/api/v1/patient-report/${id}`),
    },
    clinical: {
        getMuayeneler: (patientId: string) =>
            apiFetch<Muayene[]>(`/api/v1/clinical/patients/${patientId}/muayeneler`),
        getAllMuayenelerReport: (params?: { start_date?: string; end_date?: string; search?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.start_date) searchParams.set('start_date', params.start_date);
            if (params?.end_date) searchParams.set('end_date', params.end_date);
            if (params?.search) searchParams.set('search', params.search);
            if (params?.search) searchParams.set('search', params.search);
            return apiFetch<Muayene[]>(`/api/v1/clinical/muayeneler/report?${searchParams.toString()}`);
        },
        getMuayene: (id: number) =>
            apiFetch<Muayene>(`/api/v1/clinical/muayeneler/${id}`),
        createMuayene: (data: MuayeneCreate) =>
            apiFetch<Muayene>('/api/v1/clinical/muayeneler', { method: 'POST', body: JSON.stringify(data) }),
        updateMuayene: (id: number, data: Partial<MuayeneCreate>) =>
            apiFetch<Muayene>(`/api/v1/clinical/muayeneler/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteMuayene: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/muayeneler/${id}`, { method: 'DELETE' }),
        getOperations: (patientId: string) =>
            apiFetch<Operation[]>(`/api/v1/clinical/patients/${patientId}/operasyonlar`),
        getAllOperationsReport: (params?: { start_date?: string; end_date?: string; search?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.start_date) searchParams.set('start_date', params.start_date);
            if (params?.end_date) searchParams.set('end_date', params.end_date);
            if (params?.search) searchParams.set('search', params.search);
            return apiFetch<Operation[]>(`/api/v1/clinical/operasyonlar/report?${searchParams.toString()}`);
        },
        getOperation: (id: number) =>
            apiFetch<Operation>(`/api/v1/clinical/operasyonlar/${id}`),
        createOperation: (data: OperationCreate) =>
            apiFetch<Operation>('/api/v1/clinical/operasyonlar', { method: 'POST', body: JSON.stringify(data) }),
        updateOperation: (id: number, data: Partial<OperationCreate>) =>
            apiFetch<Operation>(`/api/v1/clinical/operasyonlar/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteOperation: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/operasyonlar/${id}`, { method: 'DELETE' }),
        getFollowUps: (patientId: string) =>
            apiFetch<FollowUp[]>(`/api/v1/clinical/patients/${patientId}/takip`),
        getFollowUp: (id: number) =>
            apiFetch<FollowUp>(`/api/v1/clinical/takip/${id}`),
        createFollowUp: (data: FollowUpCreate) =>
            apiFetch<FollowUp>('/api/v1/clinical/takip', { method: 'POST', body: JSON.stringify(data) }),
        updateFollowUp: (id: number, data: Partial<FollowUpCreate>) =>
            apiFetch<FollowUp>(`/api/v1/clinical/takip/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteFollowUp: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/takip/${id}`, { method: 'DELETE' }),

        // Imaginig (TetkikSonuc)
        getImagings: (patientId: string) =>
            apiFetch<Imaging[]>(`/api/v1/clinical/patients/${patientId}/imagings`),
        getImaging: (id: number) =>
            apiFetch<Imaging>(`/api/v1/clinical/imagings/${id}`),
        createImaging: (data: ImagingCreate) =>
            apiFetch<Imaging>('/api/v1/clinical/imagings', { method: 'POST', body: JSON.stringify(data) }),
        updateImaging: (id: number, data: Partial<ImagingCreate>) =>
            apiFetch<Imaging>(`/api/v1/clinical/imagings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteImaging: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/imagings/${id}`, { method: 'DELETE' }),

        // Labs
        // Labs
        getLabs: (patientId: string, type: string) =>
            apiFetch<any[]>(`/api/v1/clinical/patients/${patientId}/labs`), // Fetches all labs
        getLab: (id: number) =>
            apiFetch<any>(`/api/v1/clinical/labs/${id}`),
        createLab: (type: string, data: any) =>
            apiFetch<any>(`/api/v1/lab/${type}`, { method: 'POST', body: JSON.stringify(data) }),
        parseLabText: (text: string) =>
            apiFetch<any>('/api/v1/lab/parse', { method: 'POST', body: JSON.stringify({ text }) }),
        parseLabPdf: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
            const response = await fetch(`${API_BASE_URL}/api/v1/lab/parse-pdf`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `API Error: ${response.status}`);
            }
            return response.json();
        },
        analyzeLab: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
            const response = await fetch(`${API_BASE_URL}/api/v1/lab/analyze`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `API Error: ${response.status}`);
            }
            return response.json();
        },
        createGenelLabBatch: (data: any[]) =>
            apiFetch<any[]>('/api/v1/lab/genel/batch', { method: 'POST', body: JSON.stringify(data) }),
        deleteGenelLabBatch: (ids: number[]) =>
            apiFetch<boolean>('/api/v1/lab/genel/batch', { method: 'DELETE', body: JSON.stringify(ids) }),

        // Uroflowmetri
        getUroflowmetri: (patientId: string) =>
            apiFetch<LabUroflowmetri[]>(`/api/v1/lab/patients/${patientId}/uroflowmetri`),
        createUroflowmetri: (data: LabUroflowmetriCreate) =>
            apiFetch<LabUroflowmetri>('/api/v1/lab/uroflowmetri', { method: 'POST', body: JSON.stringify(data) }),
        deleteUroflowmetri: (id: number) =>
            apiFetch<void>(`/api/v1/lab/uroflowmetri/${id}`, { method: 'DELETE' }),

        // Photos
        getPhotos: (patientId: string) =>
            apiFetch<Photo[]>(`/api/v1/clinical/patients/${patientId}/photos`),
        createPhoto: (data: PhotoCreate) =>
            apiFetch<Photo>('/api/v1/clinical/photos', { method: 'POST', body: JSON.stringify(data) }),
        updatePhoto: (id: number, data: any) =>
            apiFetch<Photo>(`/api/v1/clinical/photos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deletePhoto: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/photos/${id}`, { method: 'DELETE' }),

        // Phone Calls
        getPhoneCalls: (patientId: string) =>
            apiFetch<PhoneCall[]>(`/api/v1/clinical/patients/${patientId}/phone-calls`),
        createPhoneCall: (data: PhoneCallCreate) =>
            apiFetch<PhoneCall>('/api/v1/clinical/phone-calls', { method: 'POST', body: JSON.stringify(data) }),
        updatePhoneCall: (id: number, data: Partial<PhoneCallCreate>) =>
            apiFetch<PhoneCall>(`/api/v1/clinical/phone-calls/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deletePhoneCall: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/phone-calls/${id}`, { method: 'DELETE' }),

        // Rest Reports
        getRestReports: (patientId: string) =>
            apiFetch<RestReport[]>(`/api/v1/clinical/patients/${patientId}/rest-reports`),
        getRestReport: (id: number) =>
            apiFetch<RestReport>(`/api/v1/clinical/rest-reports/${id}`),
        createRestReport: (data: RestReportCreate) =>
            apiFetch<RestReport>('/api/v1/clinical/rest-reports', { method: 'POST', body: JSON.stringify(data) }),
        updateRestReport: (id: number, data: Partial<RestReportCreate>) =>
            apiFetch<RestReport>(`/api/v1/clinical/rest-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteRestReport: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/rest-reports/${id}`, { method: 'DELETE' }),

        // Status Reports (Durum Bildirir)
        getStatusReports: (patientId: string) =>
            apiFetch<StatusReport[]>(`/api/v1/clinical/patients/${patientId}/status-reports`),
        getStatusReport: (id: number) =>
            apiFetch<StatusReport>(`/api/v1/clinical/status-reports/${id}`),
        createStatusReport: (data: StatusReportCreate) =>
            apiFetch<StatusReport>('/api/v1/clinical/status-reports', { method: 'POST', body: JSON.stringify(data) }),
        updateStatusReport: (id: number, data: Partial<StatusReportCreate>) =>
            apiFetch<StatusReport>(`/api/v1/clinical/status-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteStatusReport: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/status-reports/${id}`, { method: 'DELETE' }),

        // Medical Intervention Reports (Tıbbi Müdahale)
        getMedicalReports: (patientId: string) =>
            apiFetch<MedicalReport[]>(`/api/v1/clinical/patients/${patientId}/medical-reports`),
        getMedicalReport: (id: number) =>
            apiFetch<MedicalReport>(`/api/v1/clinical/medical-reports/${id}`),
        createMedicalReport: (data: MedicalReportCreate) =>
            apiFetch<MedicalReport>('/api/v1/clinical/medical-reports', { method: 'POST', body: JSON.stringify(data) }),
        updateMedicalReport: (id: number, data: Partial<MedicalReportCreate>) =>
            apiFetch<MedicalReport>(`/api/v1/clinical/medical-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteMedicalReport: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/medical-reports/${id}`, { method: 'DELETE' }),

        // Trus Biopsy
        getTrusBiopsies: (patientId: string) =>
            apiFetch<TrusBiyopsi[]>(`/api/v1/clinical/patients/${patientId}/trus-biopsies`),
        getTrusBiopsy: (id: number) =>
            apiFetch<TrusBiyopsi>(`/api/v1/clinical/trus-biopsies/${id}`),
        createTrusBiopsy: (data: TrusBiyopsiCreate) =>
            apiFetch<TrusBiyopsi>('/api/v1/clinical/trus-biopsies', { method: 'POST', body: JSON.stringify(data) }),
        updateTrusBiopsy: (id: number, data: Partial<TrusBiyopsiCreate>) =>
            apiFetch<TrusBiyopsi>(`/api/v1/clinical/trus-biopsies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteTrusBiopsy: (id: number) =>
            apiFetch<void>(`/api/v1/clinical/trus-biopsies/${id}`, { method: 'DELETE' }),
    },
    appointments: {
        list: (params?: { start?: string; end?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.start) searchParams.set('start', params.start);
            if (params?.end) searchParams.set('end', params.end);
            return apiFetch<Appointment[]>(`/api/v1/appointments?${searchParams.toString()}`);
        },
        getForPatient: (patientId: string) =>
            apiFetch<Appointment[]>(`/api/v1/appointments/patient/${patientId}`),
        create: (data: AppointmentCreate) =>
            apiFetch<Appointment>('/api/v1/appointments/', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: number, data: any) =>
            apiFetch<Appointment>(`/api/v1/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: number, reason?: string) =>
            apiFetch<void>(`/api/v1/appointments/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, { method: 'DELETE' }),
    },
    documents: {
        list: (patientId: string) =>
            apiFetch<any[]>(`/api/v1/documents/patients/${patientId}/documents`),
        create: (data: any) =>
            apiFetch<any>('/api/v1/documents/documents', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: number, data: any) =>
            apiFetch<any>(`/api/v1/documents/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: number) =>
            apiFetch<void>(`/api/v1/documents/documents/${id}`, { method: 'DELETE' }),
        upload: (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return apiFetch<{ status: string; url: string; filename: string }>('/api/v1/documents/upload', {
                method: 'POST',
                body: formData,
            });
        },
    },
    auth: {
        login: async (username: string, password: string) => {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Login Error: ${response.status} - ${text}`);
            }
            return response.json() as Promise<{ access_token: string; refresh_token: string; token_type: string }>;
        },
        me: () => apiFetch<SystemUser>('/api/v1/auth/me'),
        verifyPassword: (password: string) =>
            apiFetch<{ valid: boolean; is_superuser: boolean }>('/api/v1/auth/verify-password', {
                method: 'POST',
                body: JSON.stringify({ password })
            }),
        getUsers: () => apiFetch<SystemUser[]>('/api/v1/auth/users'),
        forgotUsername: async (email: string) => {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-username`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Error: ${response.status} - ${text}`);
            }
            return response.json() as Promise<{ message: string }>;
        },
        forgotPassword: async (email: string) => {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({ detail: 'Bir hata oluştu' }));
                throw new Error(data.detail || 'Bir hata oluştu');
            }
            return response.json() as Promise<{ message: string }>;
        },
        resetPassword: async (token: string, newPassword: string) => {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: newPassword }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({ detail: 'Bir hata oluştu' }));
                throw new Error(data.detail || 'Bir hata oluştu');
            }
            return response.json() as Promise<{ message: string }>;
        },
        createUser: (data: SystemUserCreate) =>
            apiFetch<SystemUser>('/api/v1/auth/users', { method: 'POST', body: JSON.stringify(data) }),
        updateUser: (id: number, data: Partial<SystemUserCreate>) =>
            apiFetch<SystemUser>(`/api/v1/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteUser: (id: number) =>
            apiFetch<void>(`/api/v1/auth/users/${id}`, { method: 'DELETE' }),
    },
    dashboard: {
        get: () => apiFetch<DashboardData>('/api/v1/dashboard'),
    },
    settings: {
        getAll: () => apiFetch<SystemSetting[]>('/api/v1/settings/'),
        get: (key: string) => apiFetch<SystemSetting>(`/api/v1/settings/${key}`),
        update: (data: SystemSettingCreate) => apiFetch<SystemSetting>('/api/v1/settings/', { method: 'POST', body: JSON.stringify(data) }),
        batchUpdate: (data: SystemSettingCreate[]) => apiFetch<SystemSetting[]>('/api/v1/settings/batch', { method: 'POST', body: JSON.stringify(data) }),
    },
    reports: {
        getStats: (params?: { start_date?: string; end_date?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.start_date) searchParams.set('start_date', params.start_date);
            if (params?.end_date) searchParams.set('end_date', params.end_date);
            return apiFetch<ExtendedReportStats>(`/api/v1/reports/stats?${searchParams.toString()}`);
        },
        getCohort: (monthsBack?: number) => {
            const searchParams = new URLSearchParams();
            if (monthsBack) searchParams.set('months_back', String(monthsBack));
            return apiFetch<CohortRow[]>(`/api/v1/reports/cohort?${searchParams.toString()}`);
        },
        getDiagnosisStats: (params: { icd_code?: string; diagnosis_text?: string; start_date?: string; end_date?: string }) => {
            const searchParams = new URLSearchParams();
            if (params.icd_code) searchParams.set('icd_code', params.icd_code);
            if (params.diagnosis_text) searchParams.set('diagnosis_text', params.diagnosis_text);
            if (params.start_date) searchParams.set('start_date', params.start_date);
            if (params.end_date) searchParams.set('end_date', params.end_date);
            return apiFetch<DiagnosisStats>(`/api/v1/reports/diagnosis?${searchParams.toString()}`);
        },
        getHeatmap: (params?: { start_date?: string; end_date?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.start_date) searchParams.set('start_date', params.start_date);
            if (params?.end_date) searchParams.set('end_date', params.end_date);
            return apiFetch<HeatmapData[]>(`/api/v1/reports/heatmap?${searchParams.toString()}`);
        },
        getReferenceCategories: (params?: { start_date?: string; end_date?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.start_date) searchParams.set('start_date', params.start_date);
            if (params?.end_date) searchParams.set('end_date', params.end_date);
            return apiFetch<ReferenceCategory[]>(`/api/v1/reports/reference-categories?${searchParams.toString()}`);
        },
        getServiceDistribution: (params?: { start_date?: string; end_date?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.start_date) searchParams.set('start_date', params.start_date);
            if (params?.end_date) searchParams.set('end_date', params.end_date);
            return apiFetch<ServiceDistribution[]>(`/api/v1/reports/service-distribution?${searchParams.toString()}`);
        },
        getReferencePatients: (params: { referans: string; start_date?: string; end_date?: string }) => {
            const searchParams = new URLSearchParams();
            searchParams.set('referans', params.referans);
            if (params.start_date) searchParams.set('start_date', params.start_date);
            if (params.end_date) searchParams.set('end_date', params.end_date);
            return apiFetch<ReferencePatient[]>(`/api/v1/reports/reference-patients?${searchParams.toString()}`);
        },
        getDrilldownPatients: (params: { type: 'weekly' | 'monthly' | 'reference'; value: string; start_date?: string; end_date?: string }) => {
            const searchParams = new URLSearchParams();
            searchParams.set('type', params.type);
            searchParams.set('value', params.value);
            if (params.start_date) searchParams.set('start_date', params.start_date);
            if (params.end_date) searchParams.set('end_date', params.end_date);
            return apiFetch<ReferencePatient[]>(`/api/v1/reports/drilldown-patients?${searchParams.toString()}`);
        },
    },
    system: {
        search_icd: (query?: string, skip: number = 0, limit: number = 100) => {
            const params = new URLSearchParams();
            if (query) params.set('q', query);
            params.set('skip', String(skip));
            params.set('limit', String(limit));
            return apiFetch<ICDTani[]>(`/api/v1/system/icd?${params.toString()}`);
        },
        create_icd: (data: ICDTaniCreate) => apiFetch<ICDTani>('/api/v1/system/icd', { method: 'POST', body: JSON.stringify(data) }),
        delete_batch_icd: (ids: number[]) => apiFetch<any>('/api/v1/system/icd/delete-batch', { method: 'POST', body: JSON.stringify(ids) }),



        // Drugs
        get_drugs: (query?: string, skip: number = 0, limit: number = 50) => {
            const params = new URLSearchParams();
            if (query) params.set('q', query);
            params.set('skip', String(skip));
            params.set('limit', String(limit));
            return apiFetch<IlacResponse[]>(`/api/v1/system/drugs?${params.toString()}`);
        },
        upload_drugs: (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return apiFetch<{ status: string; imported_count: number }>('/api/v1/system/drugs/upload', {
                method: 'POST',
                body: formData,
            });
        }
    },
    finance: {
        // Kategoriler
        getCategories: (tip?: string) => {
            const params = new URLSearchParams();
            if (tip) params.set('tip', tip);
            return apiFetch<FinansKategori[]>(`/api/v1/finance/categories?${params.toString()}`);
        },
        createCategory: (data: FinansKategoriCreate) =>
            apiFetch<FinansKategori>('/api/v1/finance/categories', { method: 'POST', body: JSON.stringify(data) }),
        updateCategory: (id: number, data: Partial<FinansKategoriCreate>) =>
            apiFetch<FinansKategori>(`/api/v1/finance/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteCategory: (id: number) =>
            apiFetch<void>(`/api/v1/finance/categories/${id}`, { method: 'DELETE' }),

        // Hizmetler (Yeni)
        getServices: (aktifOnly: boolean = true) =>
            apiFetch<FinansHizmet[]>(`/api/v1/finance/services?aktif_only=${aktifOnly}`),
        createService: (data: FinansHizmetCreate) =>
            apiFetch<FinansHizmet>('/api/v1/finance/services', { method: 'POST', body: JSON.stringify(data) }),
        updateService: (id: number, data: Partial<FinansHizmetCreate>) =>
            apiFetch<FinansHizmet>(`/api/v1/finance/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteService: (id: number) =>
            apiFetch<void>(`/api/v1/finance/services/${id}`, { method: 'DELETE' }),

        // Kasalar (Yeni)
        getAccounts: (aktifOnly: boolean = true) =>
            apiFetch<FinansKasa[]>(`/api/v1/finance/accounts?aktif_only=${aktifOnly}`),
        getAccountBalance: (id: number) =>
            apiFetch<{ kasa_id: number; ad: string; bakiye: number }>(`/api/v1/finance/accounts/${id}/balance`),
        getAccountMovements: (id: number, limit: number = 50) =>
            apiFetch<KasaHareket[]>(`/api/v1/finance/accounts/${id}/movements?limit=${limit}`),
        createAccount: (data: FinansKasaCreate) =>
            apiFetch<FinansKasa>('/api/v1/finance/accounts', { method: 'POST', body: JSON.stringify(data) }),
        transferBetweenAccounts: (kaynak_kasa_id: number, hedef_kasa_id: number, tutar: number, aciklama?: string) =>
            apiFetch<{ success: boolean }>('/api/v1/finance/accounts/transfer', {
                method: 'POST',
                body: JSON.stringify({ kaynak_kasa_id, hedef_kasa_id, tutar, aciklama })
            }),
        updateAccount: (id: number, data: Partial<FinansKasaCreate>) =>
            apiFetch<FinansKasa>(`/api/v1/finance/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteAccount: (id: number) =>
            apiFetch<void>(`/api/v1/finance/accounts/action/delete/${id}`, { method: 'DELETE' }),

        // Firmalar
        getCompanies: () => apiFetch<Firma[]>('/api/v1/finance/companies'),
        getCompanyDebts: () => apiFetch<FirmaBorcOzet[]>('/api/v1/finance/companies/debts'),
        createCompany: (data: FirmaCreate) =>
            apiFetch<Firma>('/api/v1/finance/companies', { method: 'POST', body: JSON.stringify(data) }),
        updateCompany: (id: number, data: Partial<FirmaCreate>) =>
            apiFetch<Firma>(`/api/v1/finance/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

        // İşlemler
        getTransactions: (params?: FinansIslemFilters & { skip?: number; limit?: number }) => {
            const searchParams = new URLSearchParams();
            if (params?.start_date) searchParams.set('start_date', params.start_date);
            if (params?.end_date) searchParams.set('end_date', params.end_date);
            if (params?.islem_tipi) searchParams.set('islem_tipi', params.islem_tipi);
            if (params?.durum) searchParams.set('durum', params.durum);
            if (params?.kategori_id) searchParams.set('kategori_id', String(params.kategori_id));
            if (params?.hasta_id) searchParams.set('hasta_id', params.hasta_id);
            if (params?.firma_id) searchParams.set('firma_id', String(params.firma_id));
            if (params?.referans) searchParams.set('referans', params.referans);
            if (params?.vade_gecmis !== undefined) searchParams.set('vade_gecmis', String(params.vade_gecmis));
            if (params?.skip) searchParams.set('skip', String(params.skip));
            if (params?.limit) searchParams.set('limit', String(params.limit));
            return apiFetch<{ items: FinansIslem[]; total: number }>(`/api/v1/finance/transactions?${searchParams.toString()}`);
        },
        getTransaction: (id: number) =>
            apiFetch<FinansIslem>(`/api/v1/finance/transactions/${id}`),
        createTransaction: (data: FinansIslemCreate) =>
            apiFetch<FinansIslem>('/api/v1/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
        updateTransaction: (id: number, data: Partial<FinansIslemCreate>) =>
            apiFetch<FinansIslem>(`/api/v1/finance/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        cancelTransaction: (id: number, iptal_nedeni: string) =>
            apiFetch<FinansIslem>(`/api/v1/finance/transactions/${id}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ iptal_nedeni })
            }),
        deleteTransaction: (id: number) =>
            apiFetch<void>(`/api/v1/finance/transactions/${id}`, { method: 'DELETE' }),

        // Hasta Cari
        getPatientTransactions: (hastaId: string) =>
            apiFetch<FinansIslem[]>(`/api/v1/finance/patients/${hastaId}/transactions`),
        getPatientBalance: (hastaId: string) =>
            apiFetch<HastaCari>(`/api/v1/finance/patients/${hastaId}/balance`),
        getDebtors: (minBorc: number = 0) =>
            apiFetch<BorcluHasta[]>(`/api/v1/finance/patients/debtors?min_borc=${minBorc}`),

        // Vadesi Geçmiş
        getOverdueTransactions: () =>
            apiFetch<{ items: FinansIslem[]; total: number }>('/api/v1/finance/overdue'),

        // Özet ve Raporlar
        getSummary: (startDate?: string, endDate?: string) => {
            const params = new URLSearchParams();
            if (startDate) params.set('start_date', startDate);
            if (endDate) params.set('end_date', endDate);
            return apiFetch<FinansOzet>(`/api/v1/finance/summary?${params.toString()}`);
        },
        getDailySummary: (tarih?: string) => {
            const params = new URLSearchParams();
            if (tarih) params.set('tarih', tarih);
            return apiFetch<GunlukOzet>(`/api/v1/finance/summary/daily?${params.toString()}`);
        },
        getMonthlySummary: (yil?: number) => {
            const params = new URLSearchParams();
            if (yil) params.set('yil', String(yil));
            return apiFetch<AylikOzet[]>(`/api/v1/finance/summary/monthly?${params.toString()}`);
        },

        // Eski (Geriye Uyumluluk)
        getKasalar: () => apiFetch<KasaTanim[]>('/api/v1/finance/kasalar'),
        createKasa: (data: KasaTanimCreate) => apiFetch<KasaTanim>('/api/v1/finance/kasalar', { method: 'POST', body: JSON.stringify(data) }),
        getHizmetler: () => apiFetch<HizmetTanim[]>('/api/v1/finance/hizmetler'),
        createHizmet: (data: HizmetTanimCreate) => apiFetch<HizmetTanim>('/api/v1/finance/hizmetler', { method: 'POST', body: JSON.stringify(data) }),
        getHareketler: (patientId: string) => apiFetch<HastaFinansHareket[]>(`/api/v1/finance/patients/${patientId}/hareketler`),
        createHareket: (data: HastaFinansHareketCreate) => apiFetch<HastaFinansHareket>('/api/v1/finance/hareketler', { method: 'POST', body: JSON.stringify(data) }),
        updateHareket: (id: number, data: HastaFinansHareketCreate) => apiFetch<HastaFinansHareket>(`/api/v1/finance/hareketler/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteHareket: (id: number) => apiFetch<void>(`/api/v1/finance/hareketler/${id}`, { method: 'DELETE' }),
    },
    audit: {
        list: (params?: { skip?: number; limit?: number; action?: string; user_id?: number; start_date?: string; end_date?: string }) => {
            const searchParams = new URLSearchParams();
            if (params?.skip) searchParams.set('skip', String(params.skip));
            if (params?.limit) searchParams.set('limit', String(params.limit));
            if (params?.action) searchParams.set('action', params.action);
            if (params?.user_id) searchParams.set('user_id', String(params.user_id));
            if (params?.start_date) searchParams.set('start_date', params.start_date);
            if (params?.end_date) searchParams.set('end_date', params.end_date);
            return apiFetch<AuditLog[]>(`/api/v1/audit?${searchParams.toString()}`);
        },
    },
    stock: {
        getProducts: (params?: { search?: string; skip?: number; limit?: number }) => {
            const searchParams = new URLSearchParams();
            if (params?.search) searchParams.set('search', params.search);
            if (params?.skip) searchParams.set('skip', String(params.skip));
            if (params?.limit) searchParams.set('limit', String(params.limit));
            return apiFetch<StockProduct[]>(`/api/v1/stock/products?${searchParams.toString()}`);
        },
        createProduct: (data: StockProductCreate) =>
            apiFetch<StockProduct>('/api/v1/stock/products', { method: 'POST', body: JSON.stringify(data) }),
        updateProduct: (id: number, data: Partial<StockProductCreate>) =>
            apiFetch<StockProduct>(`/api/v1/stock/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteProduct: (id: number) =>
            apiFetch<void>(`/api/v1/stock/products/${id}`, { method: 'DELETE' }),
        getProduct: (id: number) =>
            apiFetch<StockProduct>(`/api/v1/stock/products/${id}`),

        getPurchases: (productId?: number) => {
            const url = productId ? `/api/v1/stock/purchases?product_id=${productId}` : '/api/v1/stock/purchases';
            return apiFetch<StockPurchase[]>(url);
        },
        createPurchase: (data: any) =>
            apiFetch<StockPurchase>('/api/v1/stock/purchases', { method: 'POST', body: JSON.stringify(data) }),

        getMovements: (productId?: number, limit: number = 50) => {
            const searchParams = new URLSearchParams();
            if (productId) searchParams.set('product_id', String(productId));
            searchParams.set('limit', String(limit));
            return apiFetch<StockMovement[]>(`/api/v1/stock/movements?${searchParams.toString()}`);
        },
        createMovement: (data: any) =>
            apiFetch<StockMovement>('/api/v1/stock/movements', { method: 'POST', body: JSON.stringify(data) }),

        getSummary: () => apiFetch<StockSummary>('/api/v1/stock/summary'),
    },
    aiScribe: {
        getStatus: () => apiFetch<AIScribeStatus>('/api/v1/ai-scribe/status'),
        getTemplates: () => apiFetch<AIScribeTemplate[]>('/api/v1/ai-scribe/templates'),
        analyze: async (audioBlob: Blob, mode: string = 'gemini', template?: string, includeTranscript: boolean = false, patientId?: string) => {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('mode', mode);
            if (template) formData.append('template', template);
            formData.append('include_transcript', String(includeTranscript));
            if (patientId) formData.append('patient_id', patientId);

            const token = useAuthStore.getState().token;
            const response = await fetch('/api/v1/ai-scribe/analyze', {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `API Error: ${response.status}`);
            }
            return response.json() as Promise<AIScribeResponse>;
        }
    },
    integrations: {
        // Google Calendar
        getGoogleAuthUrl: () => apiFetch<{ url: string; state: string }>('/api/v1/integrations/google/auth-url'),
        getGoogleStatus: () => apiFetch<{ connected: boolean; expiry?: string; is_expired?: boolean }>('/api/v1/integrations/google/status'),

        // Appointment Sync
        syncToGoogle: (appointmentId: number) =>
            apiFetch<{ message: string; google_event_id: string }>(`/api/v1/appointments/${appointmentId}/sync`, { method: 'POST' }),
        removeFromGoogle: (appointmentId: number) =>
            apiFetch<{ message: string }>(`/api/v1/appointments/${appointmentId}/sync`, { method: 'DELETE' }),

        // iCal Download URL (returns the URL, not the file itself)
        getIcsDownloadUrl: (appointmentId: number) => `/api/v1/appointments/${appointmentId}/ics`,
    },
    labAnalysis: {
        getTrends: (data: LabTrendRequest) =>
            apiFetch<LabTrendResponse[]>('/api/v1/lab-analysis/trends', { method: 'POST', body: JSON.stringify(data) }),
    }
};

export interface Operation {
    id: number;
    hasta_id: string;
    tarih?: string;
    ameliyat?: string;
    pre_op_tani?: string;
    post_op_tani?: string;
    ekip?: string;
    hemsire?: string;
    anestezi_ekip?: string;
    anestezi_tur?: string;
    notlar?: string;
    patoloji?: string;
    post_op?: string;
    video_url?: string;
}

export interface OperationCreate {
    hasta_id: string;
    tarih?: string;
    ameliyat?: string;
    pre_op_tani?: string;
    post_op_tani?: string;
    ekip?: string;
    hemsire?: string;
    anestezi_ekip?: string;
    anestezi_tur?: string;
    notlar?: string;
    patoloji?: string;
    post_op?: string;
    video_url?: string;
}

export interface FollowUp {
    id: number;
    hasta_id: string;
    tarih?: string;
    tur?: string; // 'Genel Takip', etc.
    durum?: string; // 'Normal', 'Acil'
    notlar?: string;
    etiketler?: string;
    created_at?: string;
}

export interface FollowUpCreate {
    hasta_id: string;
    tarih?: string;
    tur?: string;
    durum?: string;
    notlar?: string;
    etiketler?: string;
}

export interface Imaging {
    id: number;
    hasta_id: string;
    tarih?: string;
    tetkik_adi?: string; // 'USG', 'BT', 'MR', etc. - mapped to 'tetkik' in UI
    sembol?: string;
    sonuc?: string; // Report text
    created_at?: string;
}

export interface ImagingCreate {
    hasta_id: string;
    tarih?: string;
    tetkik_adi?: string;
    sembol?: string;
    sonuc?: string;
}

export interface LabBiochemistry {
    id: number;
    hasta_id: string;
    tarih?: string;
    psa_total?: string;
    psa_free?: string;
    ure?: string;
    kreatinin?: string;
    egfr?: string;
    glukoz?: string;
    hba1c?: string;
    ast?: string;
    alt?: string;
    na?: string;
    k?: string;
    crp?: string;
    created_at?: string;
}

export interface LabHemogram {
    id: number;
    hasta_id: string;
    tarih?: string;
    wbc?: string;
    hb?: string;
    hct?: string;
    plt?: string;
    neu?: string;
    lym?: string;
    created_at?: string;
}

export interface LabUrine {
    id: number;
    hasta_id: string;
    tarih?: string;
    dansite?: string;
    ph?: string;
    protein?: string;
    glukoz?: string;
    keton?: string;
    bilirubin?: string;
    urobilinojen?: string;
    nitrit?: string;
    lokosit_esteraz?: string;
    kan?: string;
    sediment?: string; // Legacy field
    mik_lokosit?: string;
    mik_eritrosit?: string;
    mik_epitel?: string;
    mik_bakteri?: string;
    mik_kristaller?: string;
    mik_silindirler?: string;
    notlar?: string;
    kultur?: string; // 'Ureme Var', 'Ureme Yok'
    koloni?: string;
    bakteri?: string; // Culture bacteria
    antibiyotik?: string; // Antibiogram text
    created_at?: string;
}

export interface LabSpermiogram {
    id: number;
    hasta_id: string;
    tarih?: string;

    // Old/Common Fields
    volum?: string;
    konsantrasyon?: string;
    motilite?: string;
    morfoloji?: string;
    notlar?: string;

    // New Detailed Fields
    ph?: string;
    viskozite?: string;
    likefaksiyon?: string;
    total_sperm_sayisi?: string;

    // WHO Motility
    motilite_pr?: string;
    motilite_np?: string;
    motilite_im?: string;

    // Old Motility
    motilite_4?: string;
    motilite_3?: string;
    motilite_2?: string;
    motilite_1?: string;

    // Morphology Details
    morfoloji_bas?: string;
    morfoloji_boyun?: string;
    morfoloji_kuyruk?: string;

    created_at?: string;
}

export interface LabTrusBiopsy {
    id: number;
    hasta_id: string;
    tarih?: string;
    prostat_boyut_w?: string;
    prostat_boyut_h?: string;
    prostat_boyut_l?: string;
    prostat_volum?: string;
    tz_volum?: string;
    trus_bulgu?: string;
    trus_tani?: string;

    // New MRI/PIRADS fields
    psa_total?: string;
    rektal_tuse?: string;
    mri_var?: boolean;
    mri_tarih?: string;
    mri_ozet?: string;
    pirads_lezyon_boyut?: string;
    pirads_lezyon_lokasyon?: string;

    biopsi_tarih?: string;
    biopsi_sayi?: string;
    patoloji?: string; // JSON or separated string for checkboxes
    tumor_alanlari?: string; // JSON or separated string

    created_at?: string;
}

export interface LabUroflowmetri {
    id: number;
    hasta_id: string;
    tarih?: string;
    qmax?: number;
    average_flow?: number;
    volume?: number;
    residual_urine?: number;
    comment?: string;
    pdf_url?: string;
    created_at?: string;
}

export interface LabUroflowmetriCreate {
    hasta_id: string;
    tarih?: string;
    qmax?: number;
    average_flow?: number;
    volume?: number;
    residual_urine?: number;
    comment?: string;
    pdf_url?: string;
}

export interface Appointment {
    id: number;
    hasta_id?: string | null;
    title: string;
    start: string;
    end: string;
    status: 'scheduled' | 'completed' | 'cancelled' | 'confirmed' | 'unreachable' | 'blocked';
    type: string; // 'Muayene' | 'Kontrol' | 'Operasyon' | 'BLOCKED' | etc.
    notes?: string;
    doctor?: {
        id: number;
        username: string;
        full_name?: string;
        email?: string;
    };
    doctor_id?: number;
    hasta?: {
        id: string;
        ad: string;
        soyad: string;
        tc_kimlik?: string;
        cep_tel?: string;
    };
    created_at?: string;
    updated_at?: string;
    is_deleted?: number;
    cancel_reason?: string;
    delete_reason?: string;
}

export interface AppointmentCreate {
    hasta_id?: string | null;
    title: string;
    status?: string | null;
    start: string;
    end: string;
    type: string;
    notes?: string;
    doctor_id?: number;
}

// System User Types
// ... (rest of the file)

// System User Types
export interface SystemUser {
    id: number;
    username: string;
    full_name?: string;
    email?: string;
    role?: string;
    is_active: boolean;
    is_superuser: boolean;
}

export interface SystemUserCreate {
    username: string;
    password: string;
    full_name?: string;
    email?: string;
    role?: string;
    is_superuser?: boolean;
    is_active?: boolean;
}

export interface Photo {
    id: number;
    hasta_id: string;
    tarih?: string;
    asama?: string;
    etiketler?: string;
    dosya_yolu?: string;
    dosya_adi?: string;
    notlar?: string;
    created_at?: string;
}

export interface PhotoCreate {
    hasta_id: string;
    tarih?: string;
    asama?: string;
    etiketler?: string;
    dosya_yolu?: string;
    dosya_adi?: string;
    notlar?: string;
}

export interface SystemSetting {
    key: string;
    value?: string;
    description?: string;
    updated_at?: string;
}

export interface SystemSettingCreate {
    key: string;
    value?: string;
    description?: string;
}

// Report Types
export interface DashboardKPI {
    total_patients: number;
    new_patients_month: number;
    total_operations_month: number;
    monthly_revenue: number;
    monthly_revenue_change: number;
}

export interface PerformanceKPI {
    appointment_loyalty_rate: number;
    total_appointments: number;
    completed_appointments: number;
    no_show_appointments: number;
    exam_count: number;
    procedure_count: number;
    procedure_ratio: number;
    avg_revenue_per_patient: number;
    return_rate: number;
    returning_patients: number;
    first_time_patients: number;
}

export interface ChartDataPoint {
    name: string;
    value: number;
    value2?: number;
}

export interface HeatmapData {
    day: number; // 0=Mon, 6=Sun
    hour: number; // 0-23
    value: number;
}

export interface CohortRow {
    cohort_month: string;
    total_patients: number;
    month_0: number;
    month_1: number;
    month_2: number;
    month_3: number;
    month_4: number;
    month_5: number;
    month_6: number;
}

export interface DiagnosisFilterResult {
    id: string;
    ad: string;
    soyad: string;
    tani: string;
    tani_kodu: string;
    tarih: string;
}

export interface DiagnosisTrendPoint {
    period: string;
    count: number;
}

export interface DiagnosisStats {
    total_count: number;
    percentage_of_portfolio: number;
    trend: DiagnosisTrendPoint[];
    patients: DiagnosisFilterResult[];
}

export interface ReferenceCategory {
    category: string;
    category_label: string;
    count: number;
    percentage: number;
    sources: ChartDataPoint[];
}

export interface ServiceDistribution {
    name: string;
    count: number;
    percentage: number;
}

export interface ExtendedReportStats {
    kpi: DashboardKPI;
    performance: PerformanceKPI;
    patient_trend: ChartDataPoint[];
    revenue_chart: ChartDataPoint[];
    operation_chart: ChartDataPoint[];
    reference_stats?: ChartDataPoint[];
    reference_categories?: ReferenceCategory[];
    weekly_new_patients?: ChartDataPoint[];
    service_distribution?: ServiceDistribution[];
    heatmap?: HeatmapData[];
    cancellation_stats: ChartDataPoint[] | null;
}

// Legacy support
export interface ReportStats {
    kpi: DashboardKPI;
    patient_trend: ChartDataPoint[];
    revenue_chart: ChartDataPoint[];
    operation_chart: ChartDataPoint[];
    reference_stats?: ChartDataPoint[];
    weekly_new_patients?: ChartDataPoint[];
}

export interface ReferencePatient {
    id: string;
    ad: string;
    soyad: string;
}

export interface ICDTani {
    id: number;
    kodu: string;
    adi?: string;
    ust_kodu?: string;
    aktif?: string;
    seviye?: string;
}

export interface ICDTaniCreate {
    kodu: string;
    adi: string;
    ust_kodu?: string;
    aktif?: string;
    seviye?: string;
}

export interface IlacResponse {
    id: number;
    name: string;
    barcode?: string;
    etkin_madde?: string;
    atc_kodu?: string;
    fiyat?: string;
    firma?: string;
    recete_tipi?: string;
    aktif?: boolean;
}


export interface PhoneCall {
    id: number;
    hasta_id: string;
    tarih?: string;
    notlar?: string;
    doktor?: string;
    created_at?: string;
}

export interface PhoneCallCreate {
    hasta_id: string;
    tarih?: string;
    notlar?: string;
    doktor?: string;
}

// --- FINANCE MODULE ---

export interface KasaTanim {
    id: number;
    ad: string;
    tip: string; // 'NAKIT', 'BANKA', 'POS'
    para_birimi?: string;
    aktif: boolean;
    created_at?: string;
}

export interface KasaTanimCreate {
    ad: string;
    tip: string;
    para_birimi?: string;
    aktif?: boolean;
}

export interface HizmetTanim {
    id: number;
    ad: string;
    kod?: string;
    fiyat?: number;
    para_birimi?: string;
    kdv_orani?: number;
    aktif: boolean;
}

export interface HizmetTanimCreate {
    ad: string;
    kod?: string;
    fiyat?: number;
    para_birimi?: string;
    kdv_orani?: number;
    aktif?: boolean;
}

export interface HastaFinansHareket {
    id: number;
    hasta_id: string;
    tarih?: string;
    islem_tipi: string; // 'HIZMET' | 'TAHSILAT'
    hizmet_id?: number;
    kasa_id?: number;
    odeme_yontemi?: string;
    odeme_araci?: string;
    referans_kodu?: string;
    aciklama?: string;
    borc?: number;
    alacak?: number;
    bakiye?: number;
    doktor?: string;
    hizmet_ad?: string; // Optional (helper)
    kasa_ad?: string; // Optional (helper)
    muayene_id?: number;
    created_at?: string;
}

export interface HastaFinansHareketCreate {
    hasta_id: string;
    tarih?: string;
    islem_tipi: string;
    hizmet_id?: number;
    kasa_id?: number;
    odeme_yontemi?: string;
    odeme_araci?: string;
    referans_kodu?: string;
    aciklama?: string;
    borc?: number;
    alacak?: number;
    doktor?: string;
    muayene_id?: number;
}

export interface RestReport {
    id: number;
    hasta_id: string;
    tarih?: string;
    baslangic_tarihi?: string;
    bitis_tarihi?: string;
    icd_kodu?: string;
    tani?: string;
    karar?: string; // 'calisir' | 'kontrol'
    kontrol_tarihi?: string;
    created_at?: string;
}

export interface RestReportCreate {
    hasta_id: string;
    tarih?: string;
    baslangic_tarihi?: string;
    bitis_tarihi?: string;
    icd_kodu?: string;
    tani?: string;
    karar?: string;
    kontrol_tarihi?: string;
}
export interface RestReport {
    id: number;
    hasta_id: string;
    tarih?: string;
    baslangic_tarihi?: string;
    bitis_tarihi?: string;
    icd_kodu?: string;
    tani?: string;
    karar?: string; // 'calisir', 'kontrol'
    kontrol_tarihi?: string;
    created_at?: string;
}

export interface RestReportCreate {
    hasta_id: string;
    tarih?: string;
    baslangic_tarihi?: string;
    bitis_tarihi?: string;
    icd_kodu?: string;
    tani?: string;
    karar?: string;
    kontrol_tarihi?: string;
}

export interface StatusReport {
    id: number;
    hasta_id: string;
    tarih?: string;
    tani_bulgular?: string;
    icd_kodu?: string;
    sonuc_kanaat?: string;
    created_at?: string;
}

export interface StatusReportCreate {
    hasta_id: string;
    tarih?: string;
    tani_bulgular?: string;
    icd_kodu?: string;
    sonuc_kanaat?: string;
}

export interface MedicalReport {
    id: number;
    hasta_id: string;
    tarih?: string;
    protokol_no?: string;
    yapilan_islem?: string;
    islem_basligi?: string;
    islem_detayi?: string;
    tani?: string;
    sonuc_oneriler?: string;
    created_at?: string;
}

export interface MedicalReportCreate {
    hasta_id: string;
    tarih?: string;
    protokol_no?: string;
    yapilan_islem?: string;
    tani?: string;
    sonuc_oneriler?: string;
}


// =============================================================================
// YENİ FİNANS MODÜLÜ TİPLERİ
// =============================================================================

export interface FinansKategori {
    id: number;
    ad: string;
    tip: string; // 'gelir' | 'gider'
    ust_kategori_id?: number | null;
    renk?: string | null;
    ikon?: string | null;
    aktif: boolean;
    created_at?: string;
}

export interface FinansKategoriCreate {
    ad: string;
    tip: string;
    ust_kategori_id?: number;
    renk?: string;
    ikon?: string;
    aktif?: boolean;
}

export interface FinansHizmet {
    id: number;
    ad: string;
    kod?: string;
    kategori?: string;
    varsayilan_fiyat?: number;
    para_birimi?: string;
    kdv_orani: number;
    aktif: boolean;
    created_at?: string;
}

export interface FinansHizmetCreate {
    ad: string;
    kod?: string;
    kategori?: string;
    varsayilan_fiyat?: number;
    para_birimi?: string;
    kdv_orani?: number;
    aktif?: boolean;
}

export interface FinansKasa {
    id: number;
    ad: string;
    tip: string; // 'nakit' | 'banka' | 'pos'
    bakiye: number;
    para_birimi: string;
    banka_adi?: string;
    iban?: string;
    aktif: boolean;
    sira_no?: number;
    created_at?: string;
}

export interface FinansKasaCreate {
    ad: string;
    tip: string;
    bakiye?: number;
    para_birimi?: string;
    banka_adi?: string;
    iban?: string;
    aktif?: boolean;
    sira_no?: number;
}

export interface KasaHareket {
    id: number;
    kasa_id: number;
    islem_id?: number;
    odeme_id?: number;
    tarih?: string;
    hareket_tipi: string;
    tutar: number;
    onceki_bakiye?: number;
    sonraki_bakiye?: number;
    aciklama?: string;
    created_by?: string;
    created_at?: string;
}

export interface Firma {
    id: number;
    ad: string;
    vergi_no?: string;
    telefon?: string;
    email?: string;
    adres?: string;
    notlar?: string;
    toplam_borc?: number;
    created_at?: string;
}

export interface FirmaCreate {
    ad: string;
    vergi_no?: string;
    telefon?: string;
    email?: string;
    adres?: string;
    notlar?: string;
}

export interface FirmaBorcOzet {
    id: number;
    ad: string;
    toplam_borc: number;
    en_yakin_vade?: string;
}

export interface FinansIslemSatir {
    id: number;
    islem_id: number;
    hizmet_id?: number;
    hizmet_adi: string;
    adet: number;
    birim_fiyat: number;
    toplam: number;
    doktor?: string;
}

export interface FinansOdeme {
    id: number;
    islem_id: number;
    kasa_id?: number;
    odeme_tarihi: string;
    tutar: number;
    odeme_yontemi: string;
    banka?: string;
    taksit_sayisi: number;
    kapora: boolean;
    notlar?: string;
    kasa_adi?: string;
    created_at?: string;
}

export interface FinansIslem {
    id: number;
    referans_kodu: string;
    hasta_id?: string;
    muayene_id?: number;
    tarih: string;
    islem_tipi: string;
    durum: string;
    kategori_id?: number;
    aciklama?: string;
    tutar: number;
    kdv_orani: number;
    kdv_tutari: number;
    net_tutar: number;
    para_birimi: string;
    kasa_id?: number;
    firma_id?: number;
    doktor?: string;
    vade_tarihi?: string;
    notlar?: string;
    belge_url?: string;
    iptal_tarihi?: string;
    iptal_nedeni?: string;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    hasta_adi?: string;
    kategori_adi?: string;
    kasa_adi?: string;
    firma_adi?: string;
    satirlar?: FinansIslemSatir[];
    odemeler?: FinansOdeme[];
}

export interface FinansIslemCreate {
    hasta_id?: string;
    muayene_id?: number;
    tarih: string;
    islem_tipi: string;
    durum?: string;
    kategori_id?: number;
    aciklama?: string;
    tutar: number;
    kdv_orani?: number;
    kdv_tutari?: number;
    net_tutar: number;
    para_birimi?: string;
    kasa_id?: number;
    firma_id?: number;
    doktor?: string;
    vade_tarihi?: string;
    notlar?: string;
    satirlar?: { hizmet_id?: number; hizmet_adi: string; adet: number; birim_fiyat: number; toplam: number; doktor?: string; }[];
    odemeler?: { kasa_id?: number; odeme_tarihi: string; tutar: number; odeme_yontemi: string; banka?: string; taksit_sayisi?: number; kapora?: boolean; notlar?: string; }[];
}

export interface FinansIslemFilters {
    start_date?: string;
    end_date?: string;
    islem_tipi?: string;
    durum?: string;
    kategori_id?: number;
    hasta_id?: string;
    muayene_id?: number;
    firma_id?: number;
    kasa_id?: number;
    referans?: string;
    vade_gecmis?: boolean;
}

export interface HastaCari {
    hasta_id: string;
    hasta_adi?: string;
    toplam_borc: number;
    toplam_odeme: number;
    bakiye: number;
    vadesi_gecmis_borc: number;
    son_islem_tarihi?: string;
}

export interface BorcluHasta {
    hasta_id: string;
    hasta_adi: string;
    toplam_borc: number;
    toplam_odeme: number;
    bakiye: number;
}

export interface FinansOzet {
    toplam_gelir: number;
    toplam_gider: number;
    net_bakiye: number;
    bekleyen_tahsilat: number;
    vadesi_gecmis_islem_sayisi: number;
    bugun_gelir: number;
    bugun_gider: number;
}

export interface GunlukOzet {
    tarih: string;
    gelir: number;
    gider: number;
    net: number;
}

export interface AylikOzet {
    yil: number;
    ay: number;
    ay_adi: string;
    gelir: number;
    gider: number;
    net: number;
}

// AI Scribe Types
export interface AIScribeStatus {
    enabled: boolean;
    gemini_available: boolean;
    local_whisper: boolean;
    local_ollama: boolean;
    templates_count: number;
}

export interface AIScribeTemplate {
    id: string;
    name: string;
    description: string;
}

export interface AIScribeResponse {
    mode_used: 'gemini' | 'local' | 'hybrid_google_local' | 'hybrid_google_gemini'; // Updated modes
    processing_time_seconds: number;
    transcript?: string;
    confidence_score?: number;

    // Clinical data
    sikayet?: string;
    oyku?: string;
    disuri?: string;
    pollakiuri?: string;
    nokturi?: string;
    hematuri?: string;
    genital_akinti?: string;
    kabizlik?: string;
    tas_oyku?: string;

    // IPSS symptoms
    catallanma?: string;
    projeksiyon_azalma?: string;
    kalibre_incelme?: string;
    idrar_bas_zorluk?: string;
    kesik_idrar_yapma?: string;
    terminal_damlama?: string;
    residiv_hissi?: string;
    inkontinans?: string;

    // Sexual function
    erektil_islev?: string;
    ejakulasyon?: string;
    iief_ef_answers?: string;

    // Medical history
    ozgecmis?: string;
    soygecmis?: string;
    kullandigi_ilaclar?: string;
    kan_sulandirici?: number;
    aliskanliklar?: string;
    allerjiler?: string;

    // Diagnosis
    tani1?: string;
    tani1_icd?: string;
    tani2?: string;
    tani2_icd?: string;
    tani3?: string;
    tani3_icd?: string;
    ayirici_tanilar?: string;
    tedavi?: string;
    oneriler?: string;
    tetkikler?: string;
    clinical_note?: string;

    // Extracted Data (Dynamic)
    extracted_keywords?: string[];
}

