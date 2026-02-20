'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Plus, Trash2, Edit, LogOut, Printer, Calendar, Info, FlaskConical, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { CreateAppointmentDialog } from '@/components/appointments/create-appointment-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPhoneNumber } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ReferenceInput } from './reference-input';
import { BirthplaceSelect } from './birthplace-select';
import { useAuthStore } from '@/stores/auth-store';

function validateTCKN(value: string) {
    if (!value) return true;
    if (typeof value !== 'string') return false;
    if (value.length !== 11) return false;
    if (!/^\d+$/.test(value)) return false;
    if (value[0] === '0') return false;

    const digits = value.split('').map(Number);
    const sumOdd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    const sumEven = digits[1] + digits[3] + digits[5] + digits[7];

    const tenth = (sumOdd * 7 - sumEven) % 10;
    const eleventh = (sumOdd + sumEven + digits[9]) % 10;

    return tenth === digits[9] && eleventh === digits[10];
}

const patientSchema = z.object({
    ad: z.string().min(2, 'Ad zorunludur'),
    soyad: z.string().min(2, 'Soyad zorunludur'),
    tc_kimlik: z.string().optional(),
    dogum_tarihi: z.string().optional().refine((val) => {
        if (!val) return true;
        const year = parseInt(val.split('-')[0]);
        return year >= 1900 && year <= 2100;
    }, { message: "Geçerli bir yıl giriniz (1900-2100)" }),
    dogum_yeri: z.string().optional(),
    cinsiyet: z.string().optional(),
    medeni_hal: z.string().optional(),
    cocuk_sayisi: z.string().optional(),
    kan_grubu: z.string().optional(),
    meslek: z.string().optional(),
    kurum: z.string().optional(),
    sigorta: z.string().optional(),
    ozelsigorta: z.string().optional(),
    referans: z.string().optional(),
    doktor: z.string().optional(),
    protokol_no: z.string().optional(),
    cep_tel: z.string().optional(),
    ev_tel: z.string().optional(),
    is_tel: z.string().optional(),
    email: z.string().email('Geçersiz email').optional().or(z.literal('')),
    adres: z.string().optional(),
    sokak_kapi_no: z.string().optional(),
    ilce: z.string().optional(),
    sehir: z.string().optional(),
    postakodu: z.string().optional(),
    kimlik_notlar: z.string().optional().nullable(),
    is_passport: z.boolean().default(false).optional(),
    // New Fields
    sms_izin: z.string().optional(),
    email_izin: z.string().optional(),
    iletisim_kaynagi: z.string().optional(),
    iletisim_tercihi: z.string().optional(),
    indirim_grubu: z.string().optional(),
    dil: z.string().optional(),
    personel_ids: z.string().optional(),
    etiketler: z.string().optional(),
    kayit_notu: z.string().optional(),
    iletisim_kisi: z.array(z.object({
        yakinlik: z.string(),
        isim: z.string(),
        telefon: z.string().optional(),
    })).optional().nullable(),
}).superRefine((data, ctx) => {
    if (!data.is_passport && data.tc_kimlik && data.tc_kimlik.length > 0) {
        if (!validateTCKN(data.tc_kimlik)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Geçersiz TC Kimlik No",
                path: ["tc_kimlik"],
            });
        }
    }
});

type PatientFormValues = z.infer<typeof patientSchema>;

interface PatientFormProps {
    initialData?: any;
    onSubmit: (data: PatientFormValues) => void;
    isEditing?: boolean;
    onDelete?: () => void;
    patientId?: string;
    patientName?: string;
    isSubmitting?: boolean;
}

export function PatientForm({ initialData, onSubmit, isEditing = false, onDelete, patientId, patientName, isSubmitting = false }: PatientFormProps) {
    const router = useRouter();
    const [editMode, setEditMode] = useState(!initialData || isEditing);
    const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
    const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
    const [newContact, setNewContact] = useState({ yakinlik: '', isim: '', telefon: '' });


    const sanitizedInitialData: any = initialData ? Object.fromEntries(
        Object.entries(initialData).map(([key, value]) => [
            key,
            value === null || value === undefined ? ''
                : (typeof value === 'object' || typeof value === 'boolean') ? value
                    : String(value)
        ])
    ) : undefined;

    // Parse iletisim_kisi: may arrive as JSON string from server
    if (sanitizedInitialData) {
        const raw = sanitizedInitialData.iletisim_kisi;
        if (typeof raw === 'string') {
            try { sanitizedInitialData.iletisim_kisi = JSON.parse(raw); } catch { sanitizedInitialData.iletisim_kisi = []; }
        } else if (!Array.isArray(raw)) {
            sanitizedInitialData.iletisim_kisi = [];
        }
    }

    // Split address if it contains newline
    if (sanitizedInitialData && sanitizedInitialData.adres) {
        const parts = sanitizedInitialData.adres.split('\n');
        if (parts.length > 1) {
            sanitizedInitialData.adres = parts[0];
            sanitizedInitialData.sokak_kapi_no = parts.slice(1).join('\n');
        }
    }

    const form = useForm<PatientFormValues>({
        resolver: zodResolver(patientSchema),
        defaultValues: sanitizedInitialData || {
            ad: '', soyad: '', tc_kimlik: '', dogum_tarihi: '',
            dogum_yeri: '', cinsiyet: 'ERKEK', medeni_hal: 'EVLI',
            cocuk_sayisi: '', kan_grubu: '', meslek: '',
            kurum: '', sigorta: '', ozelsigorta: '', referans: '',
            doktor: '', protokol_no: '',
            cep_tel: '+90 ', ev_tel: '+90 ', is_tel: '+90 ', email: '',
            adres: '', sokak_kapi_no: '', ilce: '', sehir: '', postakodu: '',
            kimlik_notlar: '',
            is_passport: sanitizedInitialData?.tc_kimlik ? !validateTCKN(String(sanitizedInitialData.tc_kimlik)) : false,
            // Defaults
            sms_izin: 'Evet',
            email_izin: 'Evet',
            iletisim_kaynagi: '',
            iletisim_tercihi: '',
            indirim_grubu: '',
            dil: 'Türkçe',
            personel_ids: '',
            etiketler: '',
            kayit_notu: '',
            iletisim_kisi: [],
        },
    });

    // Fetch Settings for Doctors
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: api.settings.getAll,
    });

    // Fetch Users for Personel selection
    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['users'],
        queryFn: api.auth.getUsers,
    });

    const [doctors, setDoctors] = useState<string[]>([]);

    useEffect(() => {
        if (settings) {
            const defsSetting = settings.find((s: any) => s.key === 'system_definitions');
            if (defsSetting && typeof defsSetting.value === 'string') {
                try {
                    const defs = JSON.parse(defsSetting.value);
                    const rawDocList = defs['Doktorlar'] || [];

                    // Extract only adSoyad from doctor objects
                    const docNames = rawDocList.map((d: string) => {
                        try {
                            const parsed = JSON.parse(d);
                            // If it's a JSON object with adSoyad, return only the name
                            if (typeof parsed === 'object' && parsed.adSoyad) {
                                return parsed.adSoyad;
                            }
                            // If it's a simple string after parse, return it
                            return typeof parsed === 'string' ? parsed : d;
                        } catch {
                            // If JSON parse fails, it's a simple string
                            return d;
                        }
                    });

                    setDoctors(docNames);

                    const currentUser = useAuthStore.getState().user;
                    const fullName = currentUser?.full_name;

                    // If no initial data and we have doctors, set default to current user if matches, or first doc
                    if (!initialData && docNames.length > 0 && !form.getValues('doktor')) {
                        const matchedDoc = docNames.find((d: string) => d.toLowerCase().includes(fullName?.toLowerCase() || ''));
                        form.setValue('doktor', matchedDoc || docNames[0]);
                    }
                } catch (e) { console.error("Error parsing settings", e); }
            }
        }
    }, [settings, initialData, form]);

    // Reset form when initialData changes (e.g. after refetch)
    useEffect(() => {
        if (initialData) {
            console.log('PatientForm received initialData:', initialData);

            const sanitized: any = Object.fromEntries(
                Object.entries(initialData).map(([key, value]) => [
                    key,
                    value === null || value === undefined ? ''
                        : (typeof value === 'object' || typeof value === 'boolean') ? value
                            : String(value)
                ])
            );

            // Parse iletisim_kisi: may arrive as JSON string from server
            const rawContact = sanitized.iletisim_kisi;
            if (typeof rawContact === 'string') {
                try { sanitized.iletisim_kisi = JSON.parse(rawContact); } catch { sanitized.iletisim_kisi = []; }
            } else if (!Array.isArray(rawContact)) {
                sanitized.iletisim_kisi = [];
            }

            // Split address for form
            if (sanitized.adres) {
                const parts = sanitized.adres.split('\n');
                if (parts.length > 1) {
                    sanitized.adres = parts[0];
                    sanitized.sokak_kapi_no = parts.slice(1).join('\n'); // Join rest in case of multiple lines
                }
            }
            // Auto-detect passport mode if TCKN is invalid
            if (sanitized.tc_kimlik && !validateTCKN(String(sanitized.tc_kimlik))) {
                sanitized.is_passport = true;
            }
            form.reset(sanitized);
        }
    }, [initialData, form]);

    const handleSubmit = (data: PatientFormValues) => {
        // Combine address parts
        const combinedData = { ...data };
        if (data.sokak_kapi_no) {
            combinedData.adres = data.adres
                ? `${data.adres}\n${data.sokak_kapi_no}`
                : data.sokak_kapi_no;
        }

        onSubmit(combinedData);
        if (initialData) {
            setEditMode(false);
        }
    };

    const onError = (errors: any) => {
        console.error("Form validation errors:", errors);
        // You might want to show a toast here if errors are not obvious
    };

    return (
        <div className="space-y-6">
            {/* Top Action Bar */}
            <div className="bg-white p-2 rounded-lg border shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50 flex flex-col items-center gap-1 h-auto py-2" onClick={() => router.push('/patients/create')}>
                        <Plus className="h-5 w-5" />
                        <span className="text-[10px] font-bold">YENİ KAYIT</span>
                    </Button>
                    <Separator orientation="vertical" className="h-8 bg-slate-300" />
                    {initialData && (
                        <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 flex flex-col items-center gap-1 h-auto py-2" onClick={onDelete}>
                            <Trash2 className="h-5 w-5" />
                            <span className="text-[10px] font-bold">HASTA SİL</span>
                        </Button>
                    )}
                    <Separator orientation="vertical" className="h-8 bg-slate-300" />
                    <Button
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex flex-col items-center gap-1 h-auto py-2"
                        disabled={isSubmitting}
                        onClick={() => {
                            if (editMode) {
                                form.handleSubmit(handleSubmit, onError)();
                            } else {
                                setEditMode(true);
                            }
                        }}
                    >
                        {editMode ? (
                            isSubmitting ? (
                                <span className="flex flex-col items-center gap-1"><div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div><span className="text-[10px] font-bold">KAYDEDİLİYOR</span></span>
                            ) : (
                                <span className="flex flex-col items-center gap-1"><div className="h-5 w-5 flex items-center justify-center font-bold text-lg">💾</div><span className="text-[10px] font-bold">KAYDET</span></span>
                            )
                        ) : (
                            <span className="flex flex-col items-center gap-1"><Edit className="h-5 w-5" /><span className="text-[10px] font-bold">DÜZENLE</span></span>
                        )}
                    </Button>
                    <Separator orientation="vertical" className="h-8 bg-slate-300" />
                    <Button variant="ghost" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 flex flex-col items-center gap-1 h-auto py-2" onClick={() => router.push('/patients')}>
                        <LogOut className="h-5 w-5" />
                        <span className="text-[10px] font-bold">ÇIKIŞ</span>
                    </Button>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 flex flex-col items-center gap-1 h-auto py-2"
                        onClick={() => setAppointmentDialogOpen(true)}
                    >
                        <Calendar className="h-5 w-5" />
                        <span className="text-[10px] font-bold">+ RANDEVU</span>
                    </Button>


                    <Separator orientation="vertical" className="h-8 bg-slate-300" />
                    <Button variant="ghost" className="text-slate-600 flex flex-col items-center gap-1 h-auto py-2" onClick={() => {
                        const id = patientId || initialData?.id || initialData?.hasta_rec_id;
                        if (id) window.open(`/print/patient/${id}`, '_blank');
                    }}>
                        <Printer className="h-5 w-5" />
                        <span className="text-[10px] font-bold">PRINT</span>
                    </Button>
                </div>
            </div>

            {/* Main Form */}
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="bg-white border rounded-lg shadow-sm">
                    {/* Header Line */}
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                        <h2 className="text-red-600 font-bold uppercase tracking-wide text-sm">KİMLİK BİLGİLERİ</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-700">PROTOKOL NO :</span>
                            <FormField control={form.control} name="protokol_no" render={({ field }) => (
                                <Input
                                    {...field}
                                    disabled={true}
                                    className="w-24 h-7 text-xs font-mono font-bold text-blue-600 bg-slate-50 border-slate-200"
                                    placeholder="OTO"
                                />
                            )} />
                        </div>
                    </div>

                    <div className="p-3 grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* LEFT COLUMN - PERSONAL INFO */}
                        <div className="md:col-span-7 space-y-2">

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <FormLabel className="col-span-3 text-[10px] font-bold text-slate-600 uppercase">ADI SOYADI</FormLabel>
                                <div className="col-span-9 grid grid-cols-2 gap-2">
                                    <FormField control={form.control} name="ad" render={({ field }) => (
                                        <Input {...field} value={field.value ?? ''} disabled={!editMode} placeholder="Ad" className="h-8 text-xs" />
                                    )} />
                                    <FormField control={form.control} name="soyad" render={({ field }) => (
                                        <Input {...field} value={field.value ?? ''} disabled={!editMode} placeholder="Soyad" className="h-8 text-xs" />
                                    )} />
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <FormLabel className="col-span-3 text-[10px] font-bold text-slate-600 uppercase">DOĞUM TARİHİ</FormLabel>
                                <div className="col-span-9 grid grid-cols-2 gap-2">
                                    <FormField control={form.control} name="dogum_tarihi" render={({ field }) => (
                                        <Input type="date" {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs" />
                                    )} />
                                    <div className="flex items-center gap-2">
                                        <FormLabel className="whitespace-nowrap text-[10px] font-bold text-slate-600 uppercase w-20">DOĞUM YERİ</FormLabel>
                                        <FormField control={form.control} name="dogum_yeri" render={({ field }) => (
                                            <div className="flex-1">
                                                {editMode ? (
                                                    <BirthplaceSelect field={field} className="h-8 text-xs w-full" />
                                                ) : (
                                                    <Input value={field.value || '-'} disabled className="h-8 text-xs bg-slate-50" />
                                                )}
                                            </div>
                                        )} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <FormField control={form.control} name="is_passport" render={({ field }) => (
                                    <FormLabel className="col-span-3 text-[10px] font-bold text-slate-600 uppercase">
                                        {field.value ? "PASAPORT NO" : "TC KİMLİK NO"}
                                    </FormLabel>
                                )} />
                                <div className="col-span-9 grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <FormField control={form.control} name="tc_kimlik" render={({ field }) => {
                                            const isPassport = form.watch('is_passport');
                                            return (
                                                <div className="space-y-1">
                                                    <Input
                                                        {...field}
                                                        value={field.value ?? ''}
                                                        disabled={!editMode}
                                                        maxLength={isPassport ? 20 : 11}
                                                        className="h-8 text-xs"
                                                        placeholder={isPassport ? "Pasaport No" : "11 haneli TC"}
                                                        onChange={(e) => {
                                                            // If not passport, enforce numbers
                                                            if (!isPassport) {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                field.onChange(val);
                                                            } else {
                                                                field.onChange(e.target.value);
                                                            }
                                                        }}
                                                    />
                                                    <FormMessage className="text-[10px]" />
                                                </div>
                                            );
                                        }} />

                                        {editMode && (
                                            <FormField control={form.control} name="is_passport" render={({ field }) => (
                                                <div className="flex items-center space-x-2 pt-1">
                                                    <Checkbox
                                                        id="is_passport"
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        className="h-3 w-3"
                                                    />
                                                    <label
                                                        htmlFor="is_passport"
                                                        className="text-[10px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-500"
                                                    >
                                                        TC Kimlik No yok (Pasaport)
                                                    </label>
                                                </div>
                                            )} />
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <FormLabel className="whitespace-nowrap text-[10px] font-bold text-slate-600 uppercase w-20">CİNSİYETİ</FormLabel>
                                        <FormField control={form.control} name="cinsiyet" render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value || ""} disabled={!editMode}>
                                                <FormControl><SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Seç" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="ERKEK">Erkek</SelectItem>
                                                    <SelectItem value="KADIN">Kadın</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <FormLabel className="col-span-3 text-[10px] font-bold text-slate-600 uppercase">MEDENİ HALİ</FormLabel>
                                <div className="col-span-9 grid grid-cols-2 gap-2">
                                    <FormField control={form.control} name="medeni_hal" render={({ field }) => (
                                        <div className="flex-1">
                                            {editMode ? (
                                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                                    <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seç" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="EVLI">Evli</SelectItem>
                                                        <SelectItem value="BEKAR">Bekar</SelectItem>
                                                        <SelectItem value="DUL">Dul</SelectItem>
                                                        {field.value && !['EVLI', 'BEKAR', 'DUL'].includes(field.value) && (
                                                            <SelectItem value={field.value}>{field.value}</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input value={field.value || '-'} disabled className="h-8 text-xs bg-slate-50" />
                                            )}
                                        </div>
                                    )} />
                                    <div className="flex items-center gap-2">
                                        <FormLabel className="whitespace-nowrap text-[10px] font-bold text-slate-600 uppercase w-20">ÇOCUK SAYISI</FormLabel>
                                        <FormField control={form.control} name="cocuk_sayisi" render={({ field }) => (
                                            <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs w-full" type="number" />
                                        )} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <FormLabel className="col-span-3 text-[10px] font-bold text-slate-600 uppercase">KAN GRUBU</FormLabel>
                                <div className="col-span-9 grid grid-cols-2 gap-2">
                                    <FormField control={form.control} name="kan_grubu" render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value || ""} disabled={!editMode}>
                                            <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seç" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="A+">A Rh(+)</SelectItem>
                                                <SelectItem value="A-">A Rh(-)</SelectItem>
                                                <SelectItem value="B+">B Rh(+)</SelectItem>
                                                <SelectItem value="B-">B Rh(-)</SelectItem>
                                                <SelectItem value="AB+">AB Rh(+)</SelectItem>
                                                <SelectItem value="AB-">AB Rh(-)</SelectItem>
                                                <SelectItem value="0+">0 Rh(+)</SelectItem>
                                                <SelectItem value="0-">0 Rh(-)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} />
                                    <div className="flex items-center gap-2">
                                        <FormLabel className="whitespace-nowrap text-[10px] font-bold text-slate-600 uppercase w-20">MESLEK</FormLabel>
                                        <FormField control={form.control} name="meslek" render={({ field }) => (
                                            <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs w-full" />
                                        )} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <FormLabel className="col-span-3 text-[10px] font-bold text-slate-600 uppercase">KURUM</FormLabel>
                                <div className="col-span-9 grid grid-cols-2 gap-2">
                                    <FormField control={form.control} name="kurum" render={({ field }) => (
                                        <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs w-full" placeholder="Kurum" />
                                    )} />
                                    <div className="flex items-center gap-2">
                                        <FormLabel className="whitespace-nowrap text-[10px] font-bold text-slate-600 uppercase w-20">SİGORTA</FormLabel>
                                        <FormField control={form.control} name="sigorta" render={({ field }) => (
                                            <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs w-full" placeholder="Sigorta" />
                                        )} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <FormLabel className="col-span-3 text-[10px] font-bold text-slate-600 uppercase">ÖZEL SİGORTA</FormLabel>
                                <div className="col-span-9">
                                    <FormField control={form.control} name="ozelsigorta" render={({ field }) => (
                                        <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs w-full" placeholder="Özel Sigorta" />
                                    )} />
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <FormLabel className="col-span-3 text-[10px] font-bold text-slate-600 uppercase">REFERANS</FormLabel>
                                <div className="col-span-9">
                                    <FormField control={form.control} name="referans" render={({ field }) => (
                                        <ReferenceInput
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            disabled={!editMode}
                                        />
                                    )} />
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <FormLabel className="col-span-3 text-[10px] font-bold text-slate-600 uppercase">DOKTOR</FormLabel>
                                <div className="col-span-9">
                                    <FormField control={form.control} name="doktor" render={({ field }) => (
                                        <div className="flex gap-2 items-center">
                                            {editMode ? (
                                                <Select onValueChange={field.onChange} value={field.value || ""} disabled={!editMode}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-8 text-xs w-full">
                                                            <SelectValue placeholder="Doktor Seçiniz" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {doctors.map((doc) => (
                                                            <SelectItem key={doc} value={doc}>{doc}</SelectItem>
                                                        ))}
                                                        {/* Fallback if current value is not in list */}
                                                        {field.value && !doctors.includes(field.value) && (
                                                            <SelectItem value={field.value}>{field.value}</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input {...field} value={field.value ?? ''} disabled={true} className="h-8 text-xs w-full" />
                                            )}
                                        </div>
                                    )} />
                                </div>
                            </div>

                        </div>

                        {/* RIGHT COLUMN - CONTACT INFO */}
                        <div className="md:col-span-5 space-y-2 border-l pl-4 border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-red-500 font-bold uppercase text-[10px]">İLETİŞİM BİLGİLERİ</h3>
                                {editMode && (
                                    <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] text-teal-600 hover:text-teal-700 hover:bg-teal-50 gap-1">
                                                <Users className="h-3 w-3" />
                                                + İLETİŞİM KİŞİSİ
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-3" align="end">
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold text-slate-700">Yeni İletişim Kişisi</h4>
                                                <div className="space-y-2">
                                                    <Select value={newContact.yakinlik} onValueChange={(v) => setNewContact(prev => ({ ...prev, yakinlik: v }))}>
                                                        <SelectTrigger className="h-7 text-xs">
                                                            <SelectValue placeholder="Yakınlık seçin" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Eşi">Eşi</SelectItem>
                                                            <SelectItem value="Anne">Anne</SelectItem>
                                                            <SelectItem value="Baba">Baba</SelectItem>
                                                            <SelectItem value="Oğlu">Oğlu</SelectItem>
                                                            <SelectItem value="Kızı">Kızı</SelectItem>
                                                            <SelectItem value="Kardeşi">Kardeşi</SelectItem>
                                                            <SelectItem value="Arkadaş">Arkadaş</SelectItem>
                                                            <SelectItem value="Yakını">Yakını</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        placeholder="Ad Soyad"
                                                        value={newContact.isim}
                                                        onChange={(e) => setNewContact(prev => ({ ...prev, isim: e.target.value }))}
                                                        className="h-7 text-xs"
                                                    />
                                                    <Input
                                                        placeholder="+90 XXX XXX XX XX"
                                                        value={newContact.telefon}
                                                        onChange={(e) => setNewContact(prev => ({ ...prev, telefon: formatPhoneNumber(e.target.value) }))}
                                                        className="h-7 text-xs"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="w-full h-7 text-xs bg-teal-600 hover:bg-teal-700"
                                                        disabled={!newContact.yakinlik || !newContact.isim}
                                                        onClick={() => {
                                                            const raw = form.getValues('iletisim_kisi');
                                                            const current = Array.isArray(raw) ? raw : [];
                                                            form.setValue('iletisim_kisi', [...current, { ...newContact }], { shouldDirty: true });
                                                            setNewContact({ yakinlik: '', isim: '', telefon: '' });
                                                            setContactPopoverOpen(false);
                                                        }}
                                                    >
                                                        Ekle
                                                    </Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>

                            {/* Contact Persons Badges */}
                            {(() => {
                                const raw = form.watch('iletisim_kisi');
                                const contacts = Array.isArray(raw) ? raw : [];
                                if (contacts.length === 0) return null;
                                return (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {contacts.map((c: { yakinlik: string; isim: string; telefon?: string }, idx: number) => (
                                            <Badge key={idx} variant="outline" className="text-[10px] py-0.5 px-2 bg-teal-50 border-teal-200 text-teal-700 gap-1">
                                                <span className="font-bold">{c.yakinlik}:</span> {c.isim}{c.telefon ? ` (${c.telefon})` : ''}
                                                {editMode && (
                                                    <X
                                                        className="h-3 w-3 ml-1 cursor-pointer hover:text-red-500 transition-colors"
                                                        onClick={() => {
                                                            const raw = form.getValues('iletisim_kisi');
                                                            const current = Array.isArray(raw) ? raw : [];
                                                            form.setValue('iletisim_kisi', current.filter((_: unknown, i: number) => i !== idx), { shouldDirty: true });
                                                        }}
                                                    />
                                                )}
                                            </Badge>
                                        ))}
                                    </div>
                                );
                            })()}

                            <div className="space-y-2">

                                <div className="grid grid-cols-12 gap-1 items-center">
                                    <FormLabel className="col-span-4 text-[10px] font-bold text-slate-600 uppercase">MOBİL TELEFON</FormLabel>
                                    <div className="col-span-8">
                                        <FormField control={form.control} name="cep_tel" render={({ field }) => (
                                            <Input
                                                {...field}
                                                value={field.value ?? ''}
                                                disabled={!editMode}
                                                className="h-8 text-xs bg-blue-50/50 border-blue-100"
                                                onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                                                onFocus={(e) => {
                                                    if (!e.target.value) field.onChange('+90 ');
                                                }}
                                            />
                                        )} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 gap-1 items-center">
                                    <FormLabel className="col-span-4 text-[10px] font-bold text-slate-600 uppercase">EV TELEFONU</FormLabel>
                                    <div className="col-span-8">
                                        <FormField control={form.control} name="ev_tel" render={({ field }) => (
                                            <Input
                                                {...field}
                                                value={field.value ?? ''}
                                                disabled={!editMode}
                                                className="h-8 text-xs"
                                                placeholder="+90 XXX XXX XX XX"
                                                onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                                                onFocus={(e) => {
                                                    if (!e.target.value) field.onChange('+90 ');
                                                }}
                                            />
                                        )} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 gap-1 items-center">
                                    <FormLabel className="col-span-4 text-[10px] font-bold text-slate-600 uppercase">İŞ TELEFONU</FormLabel>
                                    <div className="col-span-8">
                                        <FormField control={form.control} name="is_tel" render={({ field }) => (
                                            <Input
                                                {...field}
                                                value={field.value ?? ''}
                                                disabled={!editMode}
                                                className="h-8 text-xs"
                                                placeholder="+90 XXX XXX XX XX"
                                                onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                                                onFocus={(e) => {
                                                    if (!e.target.value) field.onChange('+90 ');
                                                }}
                                            />
                                        )} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 gap-1 items-center">
                                    <FormLabel className="col-span-4 text-[10px] font-bold text-slate-600 uppercase">E-POSTA</FormLabel>
                                    <div className="col-span-8">
                                        <FormField control={form.control} name="email" render={({ field }) => (
                                            <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs" placeholder="ornek@gmail.com" />
                                        )} />
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-3" />

                            <div className="space-y-2">
                                <div className="text-[9px] text-red-500 font-semibold mb-1">ADRES BİLGİLERİ</div>

                                <div className="grid grid-cols-12 gap-1 items-center">
                                    <FormLabel className="col-span-4 text-[10px] font-bold text-slate-600 uppercase">MAHALLE / CADDE</FormLabel>
                                    <div className="col-span-8">
                                        <FormField control={form.control} name="adres" render={({ field }) => (
                                            <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs bg-blue-50/50 border-blue-100" />
                                        )} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 gap-1 items-center">
                                    <FormLabel className="col-span-4 text-[10px] font-bold text-slate-600 uppercase">SOKAK / KAPI NO</FormLabel>
                                    <div className="col-span-8">
                                        <FormField control={form.control} name="sokak_kapi_no" render={({ field }) => (
                                            <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs bg-white" placeholder="Sokak, Kapı No vs." />
                                        )} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 gap-1 items-center">
                                    <FormLabel className="col-span-4 text-[10px] font-bold text-slate-600 uppercase">İLÇE / ŞEHİR</FormLabel>
                                    <div className="col-span-8 grid grid-cols-2 gap-2">
                                        <FormField control={form.control} name="ilce" render={({ field }) => (
                                            <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs bg-blue-50/50 border-blue-100" placeholder="İlçe" />
                                        )} />
                                        <FormField control={form.control} name="sehir" render={({ field }) => (
                                            <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs bg-blue-50/50 border-blue-100" placeholder="Şehir" />
                                        )} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-12 gap-1 items-center">
                                    <FormLabel className="col-span-4 text-[10px] font-bold text-slate-600 uppercase">POSTA KODU</FormLabel>
                                    <div className="col-span-4">
                                        <FormField control={form.control} name="postakodu" render={({ field }) => (
                                            <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-8 text-xs bg-blue-50/50 border-blue-100" />
                                        )} />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Bottom Notes */}
                    <div className="bg-slate-50 border-t items-center p-3">
                        <h3 className="text-red-500 font-bold uppercase text-[10px] mb-1">HASTA İLE İLGİLİ DİĞER NOTLAR</h3>
                        <FormField control={form.control} name="kimlik_notlar" render={({ field }) => (
                            <Textarea
                                {...field}
                                value={field.value ?? ''}
                                disabled={!editMode}
                                className="min-h-[60px] bg-white border-slate-200 resize-none font-mono text-xs p-2"
                            />
                        )} />
                    </div>
                </form>
                {/* Other Information Section - Redesigned */}
                <div className="bg-white border rounded-lg shadow-sm mt-4">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-purple-50 rounded-t-lg">
                        <h2 className="text-purple-600 font-bold uppercase tracking-wide text-xs">DİĞER BİLGİLER</h2>
                    </div>

                    <div className="p-3 grid grid-cols-1 md:grid-cols-6 gap-4">
                        {/* Row 1 */}
                        <FormField control={form.control} name="sms_izin" render={({ field }) => (
                            <div className="space-y-1">
                                <FormLabel className="text-[10px] font-bold text-slate-600 uppercase">SMS İZNİ</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "Evet"} disabled={!editMode}>
                                    <FormControl><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seç" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Evet">Evet</SelectItem>
                                        <SelectItem value="Hayır">Hayır</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )} />

                        <FormField control={form.control} name="email_izin" render={({ field }) => (
                            <div className="space-y-1">
                                <FormLabel className="text-[10px] font-bold text-slate-600 uppercase">E-POSTA İZNİ</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "Evet"} disabled={!editMode}>
                                    <FormControl><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seç" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Evet">Evet</SelectItem>
                                        <SelectItem value="Hayır">Hayır</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )} />

                        <FormField control={form.control} name="indirim_grubu" render={({ field }) => (
                            <div className="space-y-1">
                                <FormLabel className="text-[10px] font-bold text-slate-600 uppercase">İNDİRİM GRUBU</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "Standart"} disabled={!editMode}>
                                    <FormControl><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seç" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Standart">Standart</SelectItem>
                                        <SelectItem value="VIP">VIP</SelectItem>
                                        <SelectItem value="Personel">Personel</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )} />

                        <FormField control={form.control} name="dil" render={({ field }) => (
                            <div className="space-y-1">
                                <FormLabel className="text-[10px] font-bold text-slate-600 uppercase">DİL</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "Türkçe"} disabled={!editMode}>
                                    <FormControl><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seç" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Türkçe">TR</SelectItem>
                                        <SelectItem value="İngilizce">EN</SelectItem>
                                        <SelectItem value="Arapça">AR</SelectItem>
                                        <SelectItem value="Rusça">RU</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )} />

                        {/* Row 2 */}
                        <FormField control={form.control} name="iletisim_kaynagi" render={({ field }) => {
                            // Default sources
                            const defaultSources = ["Telefon", "Whatsapp", "Email", "Google", "Sosyal Medya", "Tavsiye", "Diğer"];
                            // Try to find dynamic sources from settings
                            const setting = settings?.find((s: any) => s.key === "iletisim_kaynaklari");
                            let sources = defaultSources;
                            if (setting?.value) {
                                try {
                                    const parsed = JSON.parse(setting.value);
                                    if (Array.isArray(parsed)) sources = parsed;
                                } catch (e) {
                                    if (typeof setting.value === 'string' && !setting.value.startsWith('[')) {
                                        sources = setting.value.split(',').map((s: string) => s.trim());
                                    }
                                }
                            }
                            return (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                        <FormLabel className="text-[10px] font-bold text-slate-600 uppercase">İLETİŞİM KAYNAĞI</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Info className="h-3 w-3 text-slate-400 cursor-pointer hover:text-blue-500" />
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-2 text-xs bg-slate-800 text-white border-none">
                                                <p>Hasta Bize ilk nasıl ulaştı?</p>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={!editMode}>
                                        <FormControl><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seçiniz" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {sources.map((src: string) => (
                                                <SelectItem key={src} value={src}>{src}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )
                        }} />

                        <FormField control={form.control} name="iletisim_tercihi" render={({ field }) => (
                            <div className="space-y-1">
                                <FormLabel className="text-[10px] font-bold text-slate-600 uppercase">İLETİŞİM TERCİHİ</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""} disabled={!editMode}>
                                    <FormControl><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seçiniz" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Telefon">Telefon</SelectItem>
                                        <SelectItem value="Whatsapp">Whatsapp</SelectItem>
                                        <SelectItem value="Email">Email</SelectItem>
                                        <SelectItem value="Diğer">Diğer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )} />

                        <div className="md:col-span-2 space-y-1">
                            <FormField control={form.control} name="etiketler" render={({ field }) => (
                                <div className="space-y-1">
                                    <FormLabel className="text-[10px] font-bold text-slate-600 uppercase">ETİKETLER</FormLabel>
                                    <Input {...field} value={field.value ?? ''} disabled={!editMode} className="h-7 text-xs" placeholder="Etiketler..." />
                                </div>
                            )} />
                        </div>

                        {/* Personnel List - Full Width Row */}
                        <div className="md:col-span-6 mt-2">
                            <FormField control={form.control} name="personel_ids" render={({ field }) => (
                                <div className="space-y-2">
                                    <FormLabel className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-2">
                                        İLGİLİ PERSONEL
                                        <span className="text-[9px] text-slate-400 font-normal normal-case">(Süreçte görev alanlar)</span>
                                    </FormLabel>
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 pt-1 uppercase">
                                        {usersLoading ? (
                                            <span className="text-xs text-slate-400 col-span-5 text-center py-2">Personel listesi yükleniyor...</span>
                                        ) : (
                                            (users || []).filter((u: any) => u.is_active).map((user: any) => {
                                                const currentIds = field.value ? field.value.split(',').map((id: string) => id.trim()) : [];
                                                const isChecked = currentIds.includes(String(user.id));

                                                return (
                                                    <div key={user.id} className="flex items-center space-x-1.5">
                                                        <Checkbox
                                                            id={`personel-${user.id}`}
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => {
                                                                if (!editMode) return;
                                                                let newIds = [...currentIds];
                                                                if (checked) {
                                                                    newIds.push(String(user.id));
                                                                } else {
                                                                    newIds = newIds.filter(id => id !== String(user.id));
                                                                }
                                                                field.onChange(newIds.join(','));
                                                            }}
                                                            disabled={!editMode}
                                                            className="h-3.5 w-3.5"
                                                        />
                                                        <label
                                                            htmlFor={`personel-${user.id}`}
                                                            className="text-[10px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 cursor-pointer truncate w-full"
                                                            title={user.full_name || user.username}
                                                        >
                                                            {user.full_name || user.username}
                                                        </label>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )} />
                        </div>
                    </div>
                </div>

                {/* Footer Line - Existing Bottom Notes moved down effectively, but we keep it as container end */}
            </Form>

            <CreateAppointmentDialog
                isOpen={appointmentDialogOpen}
                onClose={() => setAppointmentDialogOpen(false)}
                patientId={patientId || initialData?.hasta_rec_id}
                patientName={patientName || (initialData ? `${initialData.ad} ${initialData.soyad}` : undefined)}
            />
        </div >
    );
}
