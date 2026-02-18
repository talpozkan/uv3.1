"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Calendar,
    MoreHorizontal,
    Plus,
    User,
    AlertCircle,
    Trash2,
    Edit2,
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    ChevronRight,
    ArrowRight,
    Wallet,
    TrendingUp,
    TrendingDown,
    X
} from "lucide-react";
import Link from "next/link";
import { format, parseISO, differenceInYears } from "date-fns";
import { tr } from "date-fns/locale";
import { usePatientStore } from '@/stores/patient-store';

import { api, Appointment, FinansOzet, BorcluHasta } from "@/lib/api";
import { lookupICDName } from "@/lib/icd-codes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CreateAppointmentDialog } from "@/components/appointments/create-appointment-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { FileText, Stethoscope, Binoculars } from 'lucide-react';
import { cn } from "@/lib/utils";

function calculateAge(dob?: string) {
    if (!dob) return '-';
    try {
        return differenceInYears(new Date(), parseISO(dob));
    } catch {
        return '-';
    }
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
    }).format(amount);
};


export default function DashboardPage() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>(undefined);
    const { setActivePatient } = usePatientStore();
    const [popoverState, setPopoverState] = useState<{ x: number, y: number, patient: any | null } | null>(null);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

    // Patient Search State
    const [adInput, setAdInput] = useState('');
    const [soyadInput, setSoyadInput] = useState('');

    // Debounced states
    const [debouncedAd, setDebouncedAd] = useState('');
    const [debouncedSoyad, setDebouncedSoyad] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedAd(adInput);
            setDebouncedSoyad(soyadInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [adInput, soyadInput]);

    // Fetch Dashboard Summary
    const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: api.dashboard.get,
        refetchInterval: 60000
    });

    // Fetch Patients (Activity-Sorted)
    const { data: patients, isLoading: isPatientsLoading } = useQuery({
        queryKey: ['patients', debouncedAd, debouncedSoyad],
        queryFn: () => api.patients.list({
            limit: 15,
            ad: debouncedAd || undefined,
            soyad: debouncedSoyad || undefined
        }),
    });

    const recentActivity = dashboardData?.recentActivity || [];

    // Fetch Today's Appointments
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: appointments, isLoading: isAppointmentsLoading } = useQuery({
        queryKey: ['appointments', 'today'],
        queryFn: () => api.appointments.list({
            start: todayStart.toISOString(),
            end: todayEnd.toISOString()
        }),
    });

    // Finance Summary
    const { data: financeSummary } = useQuery({
        queryKey: ['finance_summary'],
        queryFn: () => api.finance.getSummary(),
        refetchInterval: 120000
    });

    // Debtors
    const { data: debtors = [] } = useQuery({
        queryKey: ['finance_debtors'],
        queryFn: () => api.finance.getDebtors(0),
        refetchInterval: 120000
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.appointments.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success("Randevu silindi");
        },
        onError: () => toast.error("Silme işlemi başarısız")
    });

    const handleDelete = (id: number) => {
        if (confirm("Bu randevuyu silmek istediğinize emin misiniz?")) {
            deleteMutation.mutate(id);
        }
    };

    const handleEdit = (apt: Appointment) => {
        setEditingAppointment(apt);
        setShowCreateDialog(true);
    };

    // Sort appointments by time
    const sortedAppointments = appointments?.sort((a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
    ) || [];

    const todayStr = format(new Date(), "d MMMM yyyy, EEEE", { locale: tr });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'unreachable': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'confirmed': return 'Onaylı';
            case 'scheduled': return 'Planlı';
            case 'unreachable': return 'Ulaşılamadı';
            case 'cancelled': return 'İptal';
            case 'completed': return 'Tamamlandı';
            default: return status;
        }
    };

    if (isDashboardLoading || isAppointmentsLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Klinik Yönetimi</h2>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2 capitalize">
                        <Calendar className="h-4 w-4" />
                        {todayStr}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/patients/create">
                        <Button
                            variant="outline"
                            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                        >
                            <Plus className="h-4 w-4 mr-2 text-blue-600" />
                            Yeni Hasta
                        </Button>
                    </Link>
                    <Button
                        onClick={() => {
                            setEditingAppointment(undefined);
                            setShowCreateDialog(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Yeni Randevu
                    </Button>
                </div>
            </div>


            {/* Main Content Area */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Column: Today's Agenda (2/3 width) */}
                <div className="xl:col-span-2 space-y-6">
                    <Card className="border-white shadow-sm border-t-4 border-t-blue-500 overflow-hidden">
                        <CardHeader className="bg-white border-b border-slate-50 pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="h-0 py-1 opacity-0 pointer-events-none" />
                            </div>
                            <div className="flex flex-col lg:flex-row items-center gap-2 mt-2 px-1">
                                <Input
                                    placeholder="Ad"
                                    value={adInput}
                                    onChange={(e) => setAdInput(e.target.value)}
                                    className="flex-1 lg:max-w-[300px] h-9 text-xs bg-slate-50 border-slate-200"
                                />
                                <Input
                                    placeholder="Soyad"
                                    value={soyadInput}
                                    onChange={(e) => setSoyadInput(e.target.value)}
                                    className="flex-1 lg:max-w-[300px] h-9 text-xs bg-slate-50 border-slate-200"
                                />
                                {(adInput || soyadInput) && (
                                    <Button variant="ghost" size="icon" onClick={() => { setAdInput(''); setSoyadInput(''); }} className="h-9 w-9 text-slate-400 hover:text-red-500">
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[800px] overflow-auto">
                                <div className="max-h-[800px] overflow-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                            <TableRow>
                                                <TableHead className="w-[100px] font-semibold text-slate-500 text-xs">PROTOKOL</TableHead>
                                                <TableHead className="flex-1 min-w-[200px] font-semibold text-slate-500 text-xs">HASTA</TableHead>
                                                <TableHead className="w-[180px] font-semibold text-slate-500 text-xs">SON HAREKET (TANI)</TableHead>
                                                <TableHead className="w-[120px] font-semibold text-slate-500 text-xs text-center">SON İŞLEM</TableHead>
                                                <TableHead className="w-[110px] font-semibold text-slate-500 text-xs text-right">TELEFON</TableHead>
                                                <TableHead className="w-[40px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isPatientsLoading ? (
                                                Array(5).fill(0).map((_, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : patients?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">Hasta bulunamadı.</TableCell>
                                                </TableRow>
                                            ) : (
                                                patients?.map((patient) => (
                                                    <TableRow
                                                        key={patient.id}
                                                        className="cursor-pointer hover:bg-slate-50 transition-colors group"
                                                        onClick={(e) => {
                                                            setPopoverState({ x: e.clientX, y: e.clientY, patient: patient });
                                                            setSelectedPatientId(patient.id);
                                                            setActivePatient({
                                                                id: patient.id,
                                                                ad: patient.ad,
                                                                soyad: patient.soyad,
                                                                tc_kimlik: patient.tc_kimlik
                                                            });
                                                        }}
                                                    >
                                                        <TableCell>
                                                            <span className="font-mono text-[11px] text-blue-600 font-bold uppercase">
                                                                {patient.protokol_no || '-'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col py-0.5">
                                                                <span className="font-semibold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">
                                                                    {patient.ad} {patient.soyad}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 mt-0.5">
                                                                    {patient.tc_kimlik || 'TC yok'}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600 max-w-[180px] truncate" title={patient.son_tani ? lookupICDName(patient.son_tani) : undefined}>
                                                            {patient.son_tani ? lookupICDName(patient.son_tani) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center font-medium text-slate-700 text-xs">
                                                            <span className="text-[11px] text-slate-600">
                                                                {patient.updated_at ? format(new Date(patient.updated_at), 'dd.MM.yyyy', { locale: tr }) : '-'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-slate-600 text-[11px] font-mono text-right">
                                                            {patient.cep_tel || '-'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-blue-400 transition-all group-hover:translate-x-0.5" />
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>

                                    {/* Popover */}
                                    <Popover open={!!popoverState} onOpenChange={(open) => !open && setPopoverState(null)}>
                                        {popoverState && (
                                            <>
                                                <PopoverAnchor
                                                    virtualRef={{
                                                        current: {
                                                            getBoundingClientRect: () => ({
                                                                width: 0, height: 0,
                                                                top: popoverState.y, left: popoverState.x,
                                                                right: popoverState.x, bottom: popoverState.y,
                                                            } as any),
                                                        } as any
                                                    }}
                                                />
                                                <PopoverContent className="w-56 p-1.5 shadow-xl border-slate-100 bg-white/95 backdrop-blur-sm rounded-xl" align="start" sideOffset={5}>
                                                    <div className="px-3 py-2.5 mb-1 border-b border-slate-50">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hızlı İşlemler</p>
                                                        <p className="text-sm font-bold text-slate-800 truncate">
                                                            {popoverState.patient.ad} {popoverState.patient.soyad}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            className="justify-start gap-3 h-10 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 w-full rounded-lg"
                                                            onClick={() => router.push(`/patients/${popoverState.patient.id}`)}
                                                        >
                                                            <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center">
                                                                <FileText className="h-3.5 w-3.5" />
                                                            </div>
                                                            Hasta Detayı
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            className="justify-start gap-3 h-10 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 w-full rounded-lg"
                                                            onClick={() => router.push(`/patients/${popoverState.patient.id}/examination`)}
                                                        >
                                                            <div className="w-6 h-6 rounded-md bg-red-100 text-red-600 flex items-center justify-center">
                                                                <Stethoscope className="h-3.5 w-3.5" />
                                                            </div>
                                                            Muayene Başlat
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            className="justify-start gap-3 h-10 text-xs font-semibold text-slate-600 hover:text-green-600 hover:bg-green-50 w-full rounded-lg"
                                                            onClick={() => router.push(`/patients/${popoverState.patient.id}/followup`)}
                                                        >
                                                            <div className="w-6 h-6 rounded-md bg-green-100 text-green-600 flex items-center justify-center">
                                                                <Binoculars className="h-3.5 w-3.5" />
                                                            </div>
                                                            Takip Notu Ekle
                                                        </Button>
                                                    </div>
                                                </PopoverContent>
                                            </>
                                        )}
                                    </Popover>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Patients & Recent Logs */}
                <div className="space-y-6">
                    {/* Patient Search & List Card */}
                    <Card className="border-white shadow-sm border-t-4 border-t-indigo-500 overflow-hidden">
                        <CardHeader className="bg-white border-b border-slate-50 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-indigo-500" /> Günün Ajandası
                                    </CardTitle>
                                    <CardDescription className="text-xs font-medium text-slate-500 mt-1">Bugünkü randevu akışı</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {sortedAppointments.length === 0 ? (
                                    <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                                            <Calendar className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <p className="font-medium">Bugün için planlanmış randevu yok.</p>
                                        <p className="text-xs text-slate-400">Yeni bir randevu oluşturmak için butonu kullanın.</p>
                                    </div>
                                ) : (
                                    sortedAppointments.map((apt) => {
                                        const startTime = parseISO(apt.start);
                                        const endTime = parseISO(apt.end);
                                        const isPast = new Date() > endTime;

                                        return (
                                            <div key={apt.id} className={cn("flex group hover:bg-slate-50 transition-colors", isPast && "opacity-60")}>
                                                {/* Time Column */}
                                                <div className="w-24 shrink-0 border-r border-slate-100 p-4 flex flex-col items-end gap-1 text-right bg-slate-50/30">
                                                    <span className="text-sm font-bold text-slate-700 font-mono">{format(startTime, 'HH:mm')}</span>
                                                    <span className="text-xs text-slate-400 font-mono">{format(endTime, 'HH:mm')}</span>
                                                </div>

                                                {/* Content Column */}
                                                <div className="flex-1 p-4 flex items-start gap-4">
                                                    <div className="mt-1">
                                                        <Avatar className={cn("h-10 w-10 border border-slate-200", isPast ? "bg-slate-100" : "bg-white")}>
                                                            <AvatarFallback className="text-xs font-bold text-slate-600">
                                                                {apt.hasta ? `${apt.hasta.ad[0]}${apt.hasta.soyad[0]}` : apt.title.substring(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className="text-sm font-bold text-slate-900 truncate">
                                                                {apt.hasta ? (
                                                                    <Link href={`/patients/${apt.hasta.id}/examination`} className="hover:text-indigo-600 hover:underline transition-colors">
                                                                        {`${apt.hasta.ad} ${apt.hasta.soyad}`}
                                                                    </Link>
                                                                ) : (
                                                                    apt.title
                                                                )}
                                                            </h4>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className={cn("text-[10px] uppercase font-bold border-0 px-2 py-0.5", getStatusColor(apt.status))}>
                                                                    {getStatusLabel(apt.status)}
                                                                </Badge>

                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                                                                            <MoreHorizontal className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-32">
                                                                        <DropdownMenuItem onClick={() => handleEdit(apt)}>
                                                                            <Edit2 className="mr-2 h-3.5 w-3.5" />
                                                                            Düzenle
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleDelete(apt.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                                                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                                            Sil
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                                                            {apt.doctor?.full_name && (
                                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                                    <span>{apt.doctor.full_name}</span>
                                                                </div>
                                                            )}
                                                            {apt.type && (
                                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                                    <span>{apt.type}</span>
                                                                </div>
                                                            )}
                                                            {apt.notes && (
                                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 max-w-md truncate bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                                                    <AlertCircle className="w-3 h-3 text-slate-400" />
                                                                    <span className="italic">{apt.notes}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Activity Card */}
                    <Card className="border-white shadow-sm border-t-4 border-t-orange-500 overflow-hidden">
                        <CardHeader className="bg-white border-b border-slate-50 pb-4">
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <Clock className="h-5 w-5 text-orange-500" /> Son Hareketler
                            </CardTitle>
                            <CardDescription className="text-xs font-medium text-slate-500 mt-1">Sistem üzerindeki son işlemler</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-4">
                                {recentActivity.slice(0, 8).map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0 group">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[10px] font-bold text-slate-600 border border-slate-100 group-hover:bg-slate-100 transition-colors">
                                            {item.patientName ? item.patientName.substring(0, 2).toUpperCase() : '??'}
                                        </div>
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                            {item.patientId ? (
                                                <Link href={`/patients/${item.patientId}/examination`} className="text-xs font-bold text-slate-700 truncate hover:text-indigo-600 transition-colors">
                                                    {item.patientName}
                                                </Link>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-700 truncate">{item.patientName}</span>
                                            )}
                                            <span className="text-[10px] text-slate-500 line-clamp-1">{item.procedure}</span>
                                        </div>
                                        <span className="ml-auto text-[10px] text-slate-400 whitespace-nowrap font-mono">{item.time}</span>
                                    </div>
                                ))}
                                {recentActivity.length === 0 && (
                                    <div className="text-center text-xs text-slate-400 py-4">Hareket bulunamadı.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Debtors Widget Card */}
                    {debtors.filter(d => d.bakiye > 0).length > 0 && (
                        <Card className="border-white shadow-sm border-t-4 border-t-amber-500 overflow-hidden">
                            <CardHeader className="bg-white border-b border-slate-50 pb-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <Wallet className="h-5 w-5 text-amber-500" /> Bekleyen Ödemeler
                                    </CardTitle>
                                    <Link href="/finance/debtors" className="text-[10px] font-bold text-amber-600 hover:underline">TÜMÜ</Link>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[300px] overflow-auto">
                                    {debtors.filter(d => d.bakiye > 0).slice(0, 5).map((debtor) => (
                                        <div key={debtor.hasta_id} className="p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => router.push(`/patients/${debtor.hasta_id}/finance`)}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700 group-hover:text-amber-600 transition-colors uppercase">
                                                        {debtor.hasta_adi}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">Bakiye Borç</span>
                                                </div>
                                                <span className="text-sm font-black text-amber-600">
                                                    {formatCurrency(debtor.bakiye)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <CreateAppointmentDialog
                isOpen={showCreateDialog}
                onClose={() => {
                    setShowCreateDialog(false);
                    setEditingAppointment(undefined);
                    queryClient.invalidateQueries({ queryKey: ['appointments'] });
                }}
                appointment={editingAppointment}
            />
        </div >
    );
}

function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-slate-50/50 p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <Skeleton className="xl:col-span-2 h-96 rounded-xl" />
                <Skeleton className="h-96 rounded-xl" />
            </div>
        </div>
    );
}
