"use client";

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState, useEffect, useMemo } from 'react';
import { User, X, Search, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, FileText, Binoculars, Stethoscope, Users, Plus, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { differenceInYears, parseISO, format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PatientDetailPanel } from '@/components/patients/patient-detail-panel';
import { usePatientStore } from '@/stores/patient-store';
import { Card, CardContent } from '@/components/ui/card';

function formatDate(dateStr?: string) {
    if (!dateStr) return '-';
    try {
        return format(parseISO(dateStr), 'dd.MM.yyyy');
    } catch {
        return '-';
    }
}

function calculateAge(dob?: string) {
    if (!dob) return '-';
    try {
        return differenceInYears(new Date(), parseISO(dob));
    } catch {
        return '-';
    }
}

export default function PatientsPage() {
    const router = useRouter();
    const [adInput, setAdInput] = useState('');
    const [soyadInput, setSoyadInput] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const { setActivePatient } = usePatientStore();
    const [popoverState, setPopoverState] = useState<{ x: number, y: number, patient: any | null } | null>(null);
    const [dateSortOrder, setDateSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
    const [nameSortOrder, setNameSortOrder] = useState<'none' | 'asc' | 'desc'>('none');

    // Debounced search
    const [debouncedAd, setDebouncedAd] = useState(adInput);
    const [debouncedSoyad, setDebouncedSoyad] = useState(soyadInput);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedAd(adInput);
            setDebouncedSoyad(soyadInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [adInput, soyadInput]);

    const { data: patients, isLoading } = useQuery({
        queryKey: ['patients', debouncedAd, debouncedSoyad],
        queryFn: () => api.patients.list({
            limit: 50,
            ad: debouncedAd || undefined,
            soyad: debouncedSoyad || undefined
        }),
    });

    // Sort patients
    const sortedPatients = useMemo(() => {
        if (!patients) return [];

        let sorted = [...patients];

        // Apply name sort
        if (nameSortOrder !== 'none') {
            sorted.sort((a, b) => {
                const nameA = `${a.ad || ''} ${a.soyad || ''}`.toLowerCase();
                const nameB = `${b.ad || ''} ${b.soyad || ''}`.toLowerCase();
                return nameSortOrder === 'asc'
                    ? nameA.localeCompare(nameB, 'tr')
                    : nameB.localeCompare(nameA, 'tr');
            });
        }

        // Apply date sort (takes priority if set)
        if (dateSortOrder !== 'none') {
            sorted.sort((a, b) => {
                const dateA = a.son_muayene_tarihi ? new Date(a.son_muayene_tarihi).getTime() : 0;
                const dateB = b.son_muayene_tarihi ? new Date(b.son_muayene_tarihi).getTime() : 0;
                return dateSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });
        }

        return sorted;
    }, [patients, dateSortOrder, nameSortOrder]);

    const toggleDateSort = () => {
        setNameSortOrder('none'); // Reset name sort when date sort is used
        setDateSortOrder(prev => prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none');
    };

    const toggleNameSort = () => {
        setDateSortOrder('none'); // Reset date sort when name sort is used
        setNameSortOrder(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none');
    };

    const handleReset = () => {
        setAdInput('');
        setSoyadInput('');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-theme(spacing.4))] gap-4 p-4 bg-slate-50/50">
            {/* Top Bar - Search Area (Restored Old Layout) */}
            <div className="flex flex-col lg:flex-row items-center justify-between bg-white p-3 rounded-lg border shadow-sm gap-4">
                <div className="flex flex-1 items-center gap-2 w-full lg:w-auto">
                    <Input
                        placeholder="Ad"
                        value={adInput}
                        onChange={(e) => setAdInput(e.target.value)}
                        className="flex-1 lg:max-w-[300px] bg-slate-50 border-slate-200"
                    />
                    <Input
                        placeholder="Soyad"
                        value={soyadInput}
                        onChange={(e) => setSoyadInput(e.target.value)}
                        className="flex-1 lg:max-w-[300px] bg-slate-50 border-slate-200"
                    />
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white min-w-[80px]">
                        Ara
                    </Button>
                    {(adInput || soyadInput) && (
                        <Button variant="ghost" size="icon" onClick={handleReset} className="h-9 w-9 text-slate-400 hover:text-red-500">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
                    <span className="text-sm font-medium text-slate-600">
                        <span className="font-bold text-slate-900">{patients?.length || 0}</span> hasta
                    </span>
                    <Link href="/patients/create">
                        <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shadow-sm border-0">
                            <Plus className="h-4 w-4 mr-2" />
                            Yeni Hasta
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Split Content Area */}
            <div className="flex flex-1 flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
                {/* Left Panel: Patient List */}
                <div className="flex-1 flex flex-col bg-white rounded-lg border shadow-sm overflow-hidden h-full">
                    {/* List Header */}
                    <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2 font-medium">
                            <User className="h-5 w-5" />
                            Hasta Listesi
                        </div>
                        <span className="text-xs bg-white/20 text-white px-2 py-1 rounded">
                            {sortedPatients.length} kayıt
                        </span>
                    </div>

                    {/* Table Container */}
                    <div className="flex-1 overflow-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[100px] font-semibold text-slate-500 text-xs">PROTOKOL</TableHead>
                                    <TableHead
                                        className="flex-1 min-w-[180px] font-semibold text-slate-500 text-xs cursor-pointer hover:bg-slate-100 select-none"
                                        onClick={toggleNameSort}
                                    >
                                        <div className="flex items-center gap-1">
                                            HASTA
                                            {nameSortOrder === 'none' && <ArrowUpDown className="h-3 w-3 text-slate-400" />}
                                            {nameSortOrder === 'asc' && <ArrowUp className="h-3 w-3 text-blue-600" />}
                                            {nameSortOrder === 'desc' && <ArrowDown className="h-3 w-3 text-blue-600" />}
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[150px] font-semibold text-slate-500 text-xs">TANI</TableHead>
                                    <TableHead className="w-[50px] font-semibold text-slate-500 text-xs text-center">YAŞ</TableHead>
                                    <TableHead className="w-[110px] font-semibold text-slate-500 text-xs">TELEFON</TableHead>
                                    <TableHead
                                        className="w-[100px] font-semibold text-slate-500 text-xs text-center cursor-pointer hover:bg-slate-100 select-none"
                                        onClick={toggleDateSort}
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            TARİH
                                            {dateSortOrder === 'none' && <ArrowUpDown className="h-3 w-3 text-slate-400" />}
                                            {dateSortOrder === 'asc' && <ArrowUp className="h-3 w-3 text-blue-600" />}
                                            {dateSortOrder === 'desc' && <ArrowDown className="h-3 w-3 text-blue-600" />}
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[40px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedPatients.map((patient) => (
                                    <TableRow
                                        key={patient.id}
                                        className={cn(
                                            "cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100",
                                            selectedPatientId === patient.id && "bg-blue-50/50 hover:bg-blue-50/70"
                                        )}
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
                                                <span className={cn("font-semibold text-sm text-slate-900", selectedPatientId === patient.id && "text-blue-700")}>
                                                    {patient.ad} {patient.soyad}
                                                </span>
                                                <span className="text-[10px] text-slate-400 mt-0.5">
                                                    {patient.tc_kimlik || 'TC yok'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-600 max-w-[150px] truncate" title={patient.son_tani || undefined}>
                                            {patient.son_tani || '-'}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-slate-700 text-sm">
                                            {calculateAge(patient.dogum_tarihi)}
                                        </TableCell>
                                        <TableCell className="text-slate-600 text-xs font-mono">
                                            {patient.cep_tel || '-'}
                                        </TableCell>
                                        <TableCell className="text-center text-xs text-slate-500">
                                            {formatDate(patient.son_muayene_tarihi)}
                                        </TableCell>
                                        <TableCell>
                                            <ChevronRight className={cn("w-4 h-4 text-slate-300", selectedPatientId === patient.id && "text-blue-500")} />
                                        </TableCell>
                                    </TableRow>
                                ))}
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

                        {(sortedPatients.length === 0) && !isLoading && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                    <Search className="h-6 w-6 text-slate-300" />
                                </div>
                                <p className="text-slate-500 font-medium text-sm">Kayıt bulunamadı</p>
                                <p className="text-slate-400 text-xs mt-1">Arama kriterlerinizi değiştirerek tekrar deneyin.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Patient Detail (Contextual) */}
                <div className="w-full lg:w-[320px] flex flex-col gap-4 shrink-0 transition-all duration-300">
                    {selectedPatientId ? (
                        <PatientDetailPanel
                            patientId={selectedPatientId}
                            onPatientDeleted={() => setSelectedPatientId(null)}
                        />
                    ) : (
                        <Card className="h-full border-dashed border-2 border-slate-200 shadow-none bg-slate-50/50">
                            <CardContent className="h-full flex flex-col items-center justify-center text-center p-8">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                                    <ArrowRight className="h-6 w-6 text-slate-300" />
                                </div>
                                <h3 className="text-slate-900 font-bold text-sm">Hasta Seçimi</h3>
                                <p className="text-xs text-slate-500 mt-2 max-w-[200px] leading-relaxed">
                                    Detayları görüntülemek ve işlem yapmak için soldaki listeden bir hasta seçiniz.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div >
    );
}
