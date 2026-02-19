"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { api, LabBiochemistry, LabHemogram, LabUrine, LabSpermiogram, LabTrusBiopsy, LabUroflowmetriCreate, LabUroflowmetri, Patient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
    Calendar as CalendarIcon, Save, Trash2, Printer, Plus,
    Activity, Droplets, TestTube, Microscope, FileText, ClipboardList, Upload, File as FileIcon, Search, Download, LineChart as LineChartIcon, ArrowUpDown, Zap, FlaskConical, Beaker, BrainCircuit
} from "lucide-react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot
} from "recharts";
import { cn } from "@/lib/utils";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

import { Button } from "@/components/ui/button";
import { isResultAbnormal } from "@/lib/lab-utils";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PatientHeader } from "@/components/clinical/patient-header";
import { LabAnalysisDialog } from "@/components/lab/LabAnalysisDialog";

// Helper function to normalize Turkish characters to English and uppercase
const normalizeTestName = (str: string | null | undefined): string => {
    if (!str) return '';
    const turkishMap: Record<string, string> = {
        'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
        'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O',
        'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
    };
    return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, char => turkishMap[char] || char).toUpperCase();
};

// Calculate prostate volume: V = d1 × d2 × d3 × 0.524 (ellipsoid formula)
const calculateProstatVolume = (w: string, h: string, l: string): string => {
    const width = parseFloat(w);
    const height = parseFloat(h);
    const length = parseFloat(l);
    if (isNaN(width) || isNaN(height) || isNaN(length) || width <= 0 || height <= 0 || length <= 0) {
        return '';
    }
    // Convert mm to cm: divide each by 10, then multiply by 0.524
    const volume = (width / 10) * (height / 10) * (length / 10) * 0.524;
    return volume.toFixed(1);
};

// -- Shared Components --
const LabInput = ({ label, value, onFieldChange, unit, placeholder, ...props }: any) => (
    <div className="flex items-center gap-2">
        <Label className="w-24 text-xs font-bold text-slate-600 truncate">{label}</Label>
        <div className="relative flex-1">
            <Input
                value={value || ''}
                onChange={e => onFieldChange(e.target.value)}
                className="h-8 text-xs pr-8 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                placeholder={placeholder}
                {...props}
            />
            {unit && <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-medium">{unit}</span>}
        </div>
    </div>
);

// -- Memoized Sub-components to prevent full page re-renders on typing --

interface FastLabRow {
    id: number;
    test: string;
    result: string;
    unit: string;
    reference: string;
    date?: string;
}

const FastLabRowComponent = React.memo(({
    row,
    index,
    globalDate,
    onUpdate,
    onRemove,
    onKeyDown
}: {
    row: FastLabRow;
    index: number;
    globalDate: Date | undefined;
    onUpdate: (id: number, field: keyof FastLabRow, value: string) => void;
    onRemove: (id: number) => void;
    onKeyDown: (e: React.KeyboardEvent, id: number, field: keyof FastLabRow) => void;
}) => {
    const [localTest, setLocalTest] = useState(row.test);
    const [localResult, setLocalResult] = useState(row.result);
    const [localUnit, setLocalUnit] = useState(row.unit);
    const [localRef, setLocalRef] = useState(row.reference);
    const [localDate, setLocalDate] = useState(row.date || (globalDate ? format(globalDate, 'yyyy-MM-dd') : ''));

    useEffect(() => { setLocalTest(row.test); }, [row.test]);
    useEffect(() => { setLocalResult(row.result); }, [row.result]);
    useEffect(() => { setLocalUnit(row.unit); }, [row.unit]);
    useEffect(() => { setLocalRef(row.reference); }, [row.reference]);
    useEffect(() => {
        setLocalDate(row.date || (globalDate ? format(globalDate, 'yyyy-MM-dd') : ''));
    }, [row.date, globalDate]);

    const handleBlur = (field: keyof FastLabRow, value: string) => {
        if (row[field] !== value) {
            onUpdate(row.id, field, value);
        }
    };

    const isAbnormal = useMemo(() => {
        const result = localResult;
        const reference = localRef;
        if (!result || !reference) return false;
        return isResultAbnormal(result, reference);
    }, [localResult, localRef]);

    return (
        <tr className="border-b border-slate-50 hover:bg-slate-50/50 group transition-colors">
            <td className="py-1 px-2 text-center text-xs text-slate-300 font-mono select-none">{index + 1}</td>
            <td className="p-1">
                <input
                    type="date"
                    className="w-full h-9 px-2 rounded-lg text-xs font-medium text-slate-500 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                    value={localDate}
                    onChange={e => {
                        setLocalDate(e.target.value);
                        onUpdate(row.id, 'date', e.target.value);
                    }}
                />
            </td>
            <td className="p-1">
                <input
                    type="text"
                    list="testList"
                    placeholder="Test ara..."
                    className="w-full h-9 px-3 rounded-lg text-sm font-bold text-slate-700 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none uppercase placeholder:font-normal placeholder:capitalize"
                    value={localTest}
                    onChange={e => setLocalTest(e.target.value)}
                    onBlur={e => handleBlur('test', e.target.value)}
                    onKeyDown={e => onKeyDown(e, row.id, 'test')}
                    id={`name-${row.id}`}
                    autoComplete="off"
                />
            </td>
            <td className="p-1">
                <input
                    type="text"
                    placeholder="Değer"
                    className={cn(
                        "w-full h-9 px-3 rounded-lg text-sm font-bold bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none placeholder:font-normal",
                        isAbnormal ? "text-red-600" : "text-blue-600"
                    )}
                    value={localResult}
                    onChange={e => setLocalResult(e.target.value)}
                    onBlur={e => handleBlur('result', e.target.value)}
                    onKeyDown={e => onKeyDown(e, row.id, 'result')}
                    id={`result-${row.id}`}
                    autoComplete="off"
                />
            </td>
            <td className="p-1">
                <input
                    type="text"
                    placeholder="Birim"
                    list="unitList"
                    className="w-full h-9 px-3 rounded-lg text-xs font-medium text-slate-500 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none placeholder:font-normal"
                    value={localUnit}
                    onChange={e => setLocalUnit(e.target.value)}
                    onBlur={e => handleBlur('unit', e.target.value)}
                    onKeyDown={e => onKeyDown(e, row.id, 'unit')}
                    id={`unit-${row.id}`}
                    autoComplete="off"
                />
            </td>
            <td className="p-1">
                <input
                    type="text"
                    placeholder="Ref"
                    className="w-full h-9 px-3 rounded-lg text-xs font-medium text-slate-400 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none placeholder:font-normal"
                    value={localRef}
                    onChange={e => setLocalRef(e.target.value)}
                    onBlur={e => handleBlur('reference', e.target.value)}
                    onKeyDown={e => onKeyDown(e, row.id, 'reference')}
                    id={`reference-${row.id}`}
                    autoComplete="off"
                />
            </td>
            <td className="p-1 text-center">
                <button
                    onClick={() => onRemove(row.id)}
                    className="p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    tabIndex={-1}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </td>
        </tr>
    );
});
FastLabRowComponent.displayName = 'FastLabRowComponent';

interface BiochemistrySectionProps {
    fastLabRows: FastLabRow[];
    onFastLabUpdate: (id: number, field: keyof FastLabRow, value: string) => void;
    onRemoveRow: (id: number) => void;
    onKeyDown: (e: React.KeyboardEvent, id: number, field: keyof FastLabRow) => void;
    orderSets: any;
    onApplyOrderSet: (name: string) => void;
    historyData: any[];
    historySearch: string;
    onHistorySearchChange: (val: string) => void;
    sortConfig: any;
    onToggleSort: (key: string) => void;
    selectedHistoryIds: number[];
    onToggleHistorySelection: (id: number) => void;
    onToggleSelectAllHistory: () => void;
    onTrendClick: (testName: string) => void;
    globalDate: Date | undefined;
}

const BiochemistrySection = React.memo(({
    fastLabRows,
    onFastLabUpdate,
    onRemoveRow,
    onKeyDown,
    orderSets,
    onApplyOrderSet,
    historyData,
    historySearch,
    onHistorySearchChange,
    sortConfig,
    onToggleSort,
    selectedHistoryIds,
    onToggleHistorySelection,
    onToggleSelectAllHistory,
    onTrendClick,
    globalDate
}: BiochemistrySectionProps) => {

    const getOrderSetStyle = (index: number) => {
        const styles = [
            "text-red-600 border-red-300 hover:bg-red-50",
            "text-amber-600 border-amber-300 hover:bg-amber-50",
            "text-blue-600 border-blue-300 hover:bg-blue-50",
            "text-purple-600 border-purple-300 hover:bg-purple-50",
            "text-emerald-600 border-emerald-300 hover:bg-emerald-50",
            "text-rose-600 border-rose-300 hover:bg-rose-50",
        ];
        return styles[index % styles.length];
    };

    return (
        <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full pb-1">
                        {Object.keys(orderSets).map((setName, index) => (
                            <Button
                                key={setName}
                                variant="outline"
                                size="sm"
                                onClick={() => onApplyOrderSet(setName)}
                                className={cn(
                                    "h-6 text-[10px] font-bold uppercase tracking-wide border-dashed whitespace-nowrap flex-shrink-0",
                                    getOrderSetStyle(index)
                                )}
                            >
                                <Plus className="mr-1 h-3 w-3" /> {setName}
                            </Button>
                        ))}
                    </div>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2 px-4 w-12 text-center">#</th>
                            <th className="py-2 px-4 w-32">Tarih</th>
                            <th className="py-2 px-4">Tetkik Adı</th>
                            <th className="py-2 px-4 w-48">Sonuç</th>
                            <th className="py-2 px-4 w-32">Birim</th>
                            <th className="py-2 px-4 w-40">Referans</th>
                            <th className="py-2 px-4 w-16"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {fastLabRows.map((row, index) => (
                            <FastLabRowComponent
                                key={row.id}
                                row={row}
                                index={index}
                                globalDate={globalDate}
                                onUpdate={onFastLabUpdate}
                                onRemove={onRemoveRow}
                                onKeyDown={onKeyDown}
                            />
                        ))}
                    </tbody>
                </table>
                <datalist id="testList">
                    <option value="GLUKOZ (AKŞ)" /><option value="GLUKOZ (TKŞ)" /><option value="HBA1C" /><option value="ÜRE" /><option value="KREATİNİN" /><option value="AST" /><option value="ALT" /><option value="GGT" /><option value="LDH" /><option value="ALP" /><option value="AMİLAZ" /><option value="LİPAZ" /><option value="TOTAL PROTEİN" /><option value="ALBUMİN" /><option value="TOTAL BİLİRUBİN" /><option value="DİREKT BİLİRUBİN" /><option value="SODYUM (Na)" /><option value="POTASYUM (K)" /><option value="KLOR (Cl)" /><option value="KALSİYUM (Ca)" /><option value="FOSFOR (P)" /><option value="MAGNEZYUM (Mg)" /><option value="DEMİR (Fe)" /><option value="DEMİR BAĞLAMA KAPASİTESİ (UIBC)" /><option value="FERRİTİN" /><option value="VİTAMİN B12" /><option value="FOLAT" /><option value="TSH" /><option value="SERBEST T3" /><option value="SERBEST T4" /><option value="TESTOSTERON (TOTAL)" /><option value="TESTOSTERON (SERBEST)" /><option value="WBC" /><option value="RBC" /><option value="HGB" /><option value="HCT" /><option value="PLT" /><option value="NEU%" /><option value="LYM%" /><option value="MON%" /><option value="EOS%" /><option value="BAS%" /><option value="MCV" /><option value="MCH" /><option value="MCHC" /><option value="RDW" /><option value="MPV" /><option value="SEDİMANTASYON" /><option value="CRP" /><option value="ASO" /><option value="RF" /><option value="PSA (TOTAL)" /><option value="PSA (SERBEST)" /><option value="İDRAR: GLUKOZ" /><option value="İDRAR: PROTEİN" /><option value="İDRAR: BİLİRUBİN" /><option value="İDRAR: ÜROBİLİNOJEN" /><option value="İDRAR: KETON" /><option value="İDRAR: NİTRİT" /><option value="İDRAR: LÖKOSİT ESTERAZ" /><option value="İDRAR: DANSİTE" /><option value="İDRAR: pH" /><option value="İDRAR: ERİTROSİT" /><option value="İDRAR: LÖKOSİT" />
                </datalist>
                <datalist id="unitList">
                    <option value="mg/dL" /><option value="g/dL" /><option value="ng/dL" /><option value="ng/mL" /><option value="µg/L" /><option value="mIU/mL" /><option value="U/L" /><option value="IU/L" /><option value="mm/h" /><option value="%" /><option value="pg/mL" /><option value="mmol/L" /><option value="fl" /><option value="K/µL" /><option value="M/µL" /><option value="mg/L" /><option value="g/L" />
                </datalist>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-slate-500 uppercase">Geçmiş Sonuçlar</span>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                placeholder="Test Ara (Örn: PSA)..."
                                className="h-7 w-64 pl-8 text-[11px] bg-white border-slate-200 focus:ring-blue-100"
                                value={historySearch}
                                onChange={(e) => onHistorySearchChange(e.target.value)}
                            />
                        </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Son 50 Kayıt</span>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                <th className="py-2 px-2 w-10 text-center">
                                    <Checkbox
                                        checked={historyData.length > 0 && selectedHistoryIds.length === historyData.length}
                                        onCheckedChange={onToggleSelectAllHistory}
                                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 border-slate-300"
                                    />
                                </th>
                                <th className="py-2 px-4 w-32 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onToggleSort('tarih')}>
                                    <div className="flex items-center gap-1">
                                        Tarih
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === 'tarih' ? "text-blue-600" : "text-slate-300")} />
                                    </div>
                                </th>
                                <th className="py-2 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onToggleSort('tetkik_adi')}>
                                    <div className="flex items-center gap-1">
                                        Tetkik
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === 'tetkik_adi' ? "text-blue-600" : "text-slate-300")} />
                                    </div>
                                </th>
                                <th className="py-2 px-4 w-32">Sonuç</th>
                                <th className="py-2 px-4 w-24">Birim</th>
                                <th className="py-2 px-4 w-24">Referans</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {historyData.length === 0 ? (
                                <tr><td colSpan={6} className="p-4 text-center text-slate-400">Kayıt bulunamadı.</td></tr>
                            ) : (
                                historyData.map((lab: any) => {
                                    const isAbnormal = isResultAbnormal(lab.sonuc, lab.referans_araligi);
                                    return (
                                        <tr key={lab.id} className={cn("border-b border-slate-50 hover:bg-slate-50 transition-all", selectedHistoryIds.includes(lab.id) && "bg-blue-50/50")}>
                                            <td className="py-2 px-2 text-center">
                                                <Checkbox
                                                    checked={selectedHistoryIds.includes(lab.id)}
                                                    onCheckedChange={() => onToggleHistorySelection(lab.id)}
                                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 border-slate-300"
                                                />
                                            </td>
                                            <td className="py-2 px-4 font-mono text-slate-500">{lab.tarih ? format(parseISO(lab.tarih), 'dd.MM.yyyy') : '-'}</td>
                                            <td className="py-2 px-4 font-bold text-slate-700">
                                                <button
                                                    onClick={() => onTrendClick(lab.tetkik_adi)}
                                                    className="hover:text-blue-600 hover:underline flex items-center gap-1 group/btn text-left"
                                                >
                                                    {normalizeTestName(lab.tetkik_adi)}
                                                    <LineChartIcon className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 text-blue-500" />
                                                </button>
                                            </td>
                                            <td className={cn(
                                                "py-2 px-4 font-bold font-mono",
                                                isAbnormal ? "text-red-600" : "text-blue-600"
                                            )}>{lab.sonuc}</td>
                                            <td className="py-2 px-4 text-slate-500">{lab.birim}</td>
                                            <td className="py-2 px-4 text-slate-400 text-[10px] font-mono whitespace-nowrap">{lab.referans_araligi || '-'}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});
BiochemistrySection.displayName = 'BiochemistrySection';

interface HemogramSectionProps {
    values: Partial<LabHemogram>;
    onChange: (values: Partial<LabHemogram>) => void;
}

const HemogramSection = React.memo(({ values, onChange }: HemogramSectionProps) => {
    return (
        <div className="bg-white rounded-xl border-t-4 border-t-blue-500 shadow-sm p-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-6">Hemogram Parametreleri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <LabInput label="WBC" unit="10^3/uL" value={values.wbc} onFieldChange={(v: string) => onChange({ ...values, wbc: v })} />
                <LabInput label="HGB" unit="g/dL" value={values.hb} onFieldChange={(v: string) => onChange({ ...values, hb: v })} />
                <LabInput label="HCT" unit="%" value={values.hct} onFieldChange={(v: string) => onChange({ ...values, hct: v })} />
                <LabInput label="PLT" unit="10^3/uL" value={values.plt} onFieldChange={(v: string) => onChange({ ...values, plt: v })} />
                <LabInput label="NEU" unit="%" value={values.neu} onFieldChange={(v: string) => onChange({ ...values, neu: v })} />
                <LabInput label="LYM" unit="%" value={values.lym} onFieldChange={(v: string) => onChange({ ...values, lym: v })} />
            </div>
        </div>
    );
});
HemogramSection.displayName = 'HemogramSection';

interface TrusBiopsySectionProps {
    patientId: string;
    values: Partial<LabTrusBiopsy>;
    onChange: (values: Partial<LabTrusBiopsy>) => void;
    biopsyDate: Date | undefined;
    onBiopsyDateChange: (date: Date | undefined) => void;
    pathologyChecks: string[];
    onPathologyChecksChange: (checks: string[]) => void;
    tumorChecks: string[];
    onTumorChecksChange: (checks: string[]) => void;
    historyData: any[];
    sortConfig: any;
    onToggleSort: (key: string) => void;
    trusTemplates: any[];
}

const TrusBiopsySection = React.memo(({
    patientId,
    values,
    onChange,
    biopsyDate,
    onBiopsyDateChange,
    pathologyChecks,
    onPathologyChecksChange,
    tumorChecks,
    onTumorChecksChange,
    historyData,
    sortConfig,
    onToggleSort,
    trusTemplates
}: TrusBiopsySectionProps) => {
    const [localBulgu, setLocalBulgu] = useState(values.trus_bulgu || '');
    useEffect(() => { setLocalBulgu(values.trus_bulgu || ''); }, [values.trus_bulgu]);

    return (
        <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-xl border-t-4 border-t-indigo-500 shadow-sm p-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">TRUS (Transrektal Ultrasonografi)</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Label className="w-32 text-xs font-bold text-slate-600">Prostat Boyutları</Label>
                            <div className="flex gap-2 flex-1">
                                <Input className="h-8 text-xs text-center bg-slate-50" placeholder="mm" value={values.prostat_boyut_w || ''} onChange={e => {
                                    const w = e.target.value;
                                    const h = values.prostat_boyut_h || '';
                                    const l = values.prostat_boyut_l || '';
                                    const vol = calculateProstatVolume(w, h, l);
                                    onChange({ ...values, prostat_boyut_w: w, prostat_volum: vol });
                                }} />
                                <Input className="h-8 text-xs text-center bg-slate-50" placeholder="mm" value={values.prostat_boyut_h || ''} onChange={e => {
                                    const h = e.target.value;
                                    const w = values.prostat_boyut_w || '';
                                    const l = values.prostat_boyut_l || '';
                                    const vol = calculateProstatVolume(w, h, l);
                                    onChange({ ...values, prostat_boyut_h: h, prostat_volum: vol });
                                }} />
                                <Input className="h-8 text-xs text-center bg-slate-50" placeholder="mm" value={values.prostat_boyut_l || ''} onChange={e => {
                                    const l = e.target.value;
                                    const w = values.prostat_boyut_w || '';
                                    const h = values.prostat_boyut_h || '';
                                    const vol = calculateProstatVolume(w, h, l);
                                    onChange({ ...values, prostat_boyut_l: l, prostat_volum: vol });
                                }} />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="w-32 text-xs font-bold text-slate-600">Prostat Volüm</Label>
                            <div className="relative flex-1">
                                <Input className="h-8 text-xs pr-8 bg-slate-50" value={values.prostat_volum || ''} onChange={e => onChange({ ...values, prostat_volum: e.target.value })} />
                                <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-medium">cc</span>
                            </div>
                            <Label className="w-20 text-xs font-bold text-slate-600 text-right">TZ Volüm</Label>
                            <div className="relative flex-1">
                                <Input className="h-8 text-xs pr-8 bg-slate-50" value={values.tz_volum || ''} onChange={e => onChange({ ...values, tz_volum: e.target.value })} />
                                <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-medium">cc</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">TRUS Bulguları</Label>
                        <Textarea
                            value={localBulgu}
                            onChange={e => setLocalBulgu(e.target.value)}
                            onBlur={() => onChange({ ...values, trus_bulgu: localBulgu })}
                            className="h-[80px] text-xs bg-slate-50 border-slate-200 resize-none"
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">TRUS Tanısı</Label>
                    <Input value={values.trus_tani || ''} onChange={e => onChange({ ...values, trus_tani: e.target.value })} className="h-8 text-xs bg-slate-50 border-slate-200" />
                </div>

                {/* MRI / PIRADS Section */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">MRI Füzyon / PIRADS Verileri</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="mri_var"
                                checked={values.mri_var || false}
                                onCheckedChange={(c) => onChange({ ...values, mri_var: c as boolean })}
                            />
                            <Label htmlFor="mri_var" className="text-xs font-bold text-slate-600">MRI Mevcut</Label>
                        </div>
                        {values.mri_var && (
                            <>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-400">MRI Tarihi</Label>
                                    <Input
                                        type="date"
                                        className="h-8 text-xs bg-slate-50"
                                        value={values.mri_tarih ? (typeof values.mri_tarih === 'string' ? values.mri_tarih : format(values.mri_tarih, 'yyyy-MM-dd')) : ''}
                                        onChange={e => onChange({ ...values, mri_tarih: e.target.value as any })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-400">PIRADS Skoru</Label>
                                    <Input
                                        className="h-8 text-xs bg-slate-50"
                                        placeholder="Örn: PIRADS 4"
                                        value={values.mri_ozet || ''}
                                        onChange={e => onChange({ ...values, mri_ozet: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-400">Lezyon Boyutu</Label>
                                    <Input
                                        className="h-8 text-xs bg-slate-50"
                                        placeholder="Örn: 12x8 mm"
                                        value={values.pirads_lezyon_boyut || ''}
                                        onChange={e => onChange({ ...values, pirads_lezyon_boyut: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-400">Lezyon Lokasyonu</Label>
                                    <Input
                                        className="h-8 text-xs bg-slate-50"
                                        placeholder="Örn: Sağ Periferal Zon, Apex"
                                        value={values.pirads_lezyon_lokasyon || ''}
                                        onChange={e => onChange({ ...values, pirads_lezyon_lokasyon: e.target.value })}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border-t-4 border-t-pink-500 shadow-sm p-6">
                <div className="flex items-center gap-6 mb-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Prostat Biyopsisi</h3>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold text-slate-600">Biyopsi Tarihi</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className={cn("flex items-center h-8 w-[130px] justify-start text-left font-normal text-xs border border-slate-200 bg-slate-50 px-3 rounded-md", !biopsyDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {biopsyDate ? format(biopsyDate, "dd.MM.yyyy") : <span>Seçiniz</span>}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={biopsyDate} onSelect={onBiopsyDateChange} initialFocus />
                                <div className="flex justify-between p-2 border-t border-slate-100 bg-slate-50/50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                        onClick={() => onBiopsyDateChange(undefined)}
                                    >
                                        Temizle
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                                        onClick={() => onBiopsyDateChange(new Date())}
                                    >
                                        Bugün
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold text-slate-600">Biyopsi Sayısı</Label>
                        <Input className="h-8 w-20 text-xs bg-slate-50" value={values.biopsi_sayi || ''} onChange={e => onChange({ ...values, biopsi_sayi: e.target.value })} />
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto gap-2 bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100 h-8"
                        disabled={!values.biopsi_sayi || parseInt(values.biopsi_sayi) <= 0}
                        onClick={() => {
                            const count = parseInt(values.biopsi_sayi || '12') || 12;
                            const dateStr = biopsyDate ? format(biopsyDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
                            const params = new URLSearchParams({
                                patientId: patientId,
                                count: String(count),
                                date: dateStr,
                                pirads: values.mri_ozet || '',
                                lezyonYeri: values.pirads_lezyon_lokasyon || '',
                                lezyonBoyut: values.pirads_lezyon_boyut || '',
                                mriVar: values.mri_var ? 'true' : 'false',
                                prostatW: values.prostat_boyut_w || '',
                                prostatH: values.prostat_boyut_h || '',
                                prostatL: values.prostat_boyut_l || '',
                                prostatVolum: values.prostat_volum || ''
                            });
                            window.open(`/print/pathology-form?${params.toString()}`, '_blank');
                        }}
                        title={!values.biopsi_sayi ? "Önce biyopsi sayısını girin" : "Patoloji Formu Yazdır"}
                    >
                        <Printer className="w-4 h-4" />
                        Patoloji Formu
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="rounded-lg border border-slate-100 p-4 bg-slate-50/50">
                        <Label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Patoloji Sonucu</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {['BPH', 'BPH + Kr.Prostatit', 'High Grade PIN', 'ASAP', 'Adeno Ca', 'Diğer'].map(item => (
                                <div key={item} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`path-${item}`}
                                        checked={pathologyChecks.includes(item)}
                                        onCheckedChange={(checked) => {
                                            if (checked) onPathologyChecksChange([...pathologyChecks, item]);
                                            else onPathologyChecksChange(pathologyChecks.filter(x => x !== item));
                                        }}
                                    />
                                    <label htmlFor={`path-${item}`} className="text-xs font-medium text-slate-700">{item}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-4 bg-slate-50/50">
                        <Label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Tümörlü Biyopsi Alanları</Label>
                        <ScrollArea className="h-[200px] pr-2">
                            <div className="space-y-2">
                                {trusTemplates.length > 0 ? trusTemplates.map((tpl: string, index: number) => {
                                    const parts = tpl.split('|');
                                    const num = parts[0]?.trim();
                                    const loc = parts[1]?.trim();
                                    return (
                                        <div key={index} className="flex items-center space-x-2 border-b border-slate-100 pb-1 last:border-0">
                                            <Checkbox
                                                id={`tumor-tpl-${index}`}
                                                checked={tumorChecks.includes(num)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) onTumorChecksChange([...tumorChecks, num]);
                                                    else onTumorChecksChange(tumorChecks.filter(x => x !== num));
                                                }}
                                            />
                                            <label htmlFor={`tumor-tpl-${index}`} className="text-xs font-medium text-slate-700 flex-1">
                                                <span className="font-bold mr-2 text-slate-400">#{num}</span>
                                                {loc}
                                            </label>
                                        </div>
                                    );
                                }) : (
                                    <div className="text-xs text-slate-400 italic">
                                        Şablon bulunamadı. Lütfen Ayarlar {'>'} Tanım Listeleri {'>'} TRUS Biyopsi Şablonu alanından tanımlama yapınız.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                    <span>Geçmiş TRUS ve Biyopsi Sonuçları</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                <th className="py-2 px-4 w-32 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onToggleSort('tarih')}>
                                    <div className="flex items-center gap-1">
                                        Tarih
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === 'tarih' ? "text-blue-600" : "text-slate-300")} />
                                    </div>
                                </th>
                                <th className="py-2 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onToggleSort('tetkik_adi')}>
                                    <div className="flex items-center gap-1">
                                        Tetkik
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === 'tetkik_adi' ? "text-blue-600" : "text-slate-300")} />
                                    </div>
                                </th>
                                <th className="py-2 px-4">Sonuç</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {historyData.length === 0 ? (
                                <tr><td colSpan={3} className="p-4 text-center text-slate-400">Kayıt yok.</td></tr>
                            ) : (
                                historyData.map((lab: any) => (
                                    <tr key={lab.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                                        <td className="py-2 px-4 font-mono text-slate-500">{lab.tarih ? format(parseISO(lab.tarih), 'dd.MM.yyyy') : '-'}</td>
                                        <td className="py-2 px-4 font-bold text-slate-700">{normalizeTestName(lab.tetkik_adi)}</td>
                                        <td className="py-2 px-4 font-bold text-blue-600 font-mono whitespace-pre-wrap">{lab.sonuc}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});
TrusBiopsySection.displayName = 'TrusBiopsySection';

// -- Memoized Sub-components to prevent full page re-renders on typing --


interface UrineSectionProps {
    values: Partial<LabUrine>;
    onChange: (values: Partial<LabUrine>) => void;
    historyData: any[];
    sortConfig: any;
    onToggleSort: (key: string) => void;
}

const UrineSection = React.memo(({ values, onChange, historyData, sortConfig, onToggleSort }: UrineSectionProps) => {
    // Helper components localized to UrineSection for better organization
    const InputField = ({ label, value, field, suffix = "", placeholder = "" }: { label: string, value: any, field: keyof LabUrine, suffix?: string, placeholder?: string }) => {
        const [localVal, setLocalVal] = useState(value || '');
        useEffect(() => { setLocalVal(value || ''); }, [value]);

        const handleBlur = () => {
            if (localVal !== (values[field] || '')) {
                onChange({ ...values, [field]: localVal });
            }
        };

        return (
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                <div className="relative">
                    <input
                        type="text"
                        value={localVal}
                        onChange={(e) => setLocalVal(e.target.value)}
                        onBlur={handleBlur}
                        placeholder={placeholder}
                        className="w-full h-8 p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all bg-slate-50 focus:bg-white text-[11px] font-medium"
                    />
                    {suffix && <span className="absolute right-2 top-1.5 text-slate-400 text-[10px] font-bold">{suffix}</span>}
                </div>
            </div>
        );
    };

    const QuickSelectField = ({ label, value, field, options }: { label: string, value: any, field: keyof LabUrine, options: string[] }) => (
        <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
            <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange({ ...values, [field]: opt })}
                        className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded-md border transition-all uppercase tracking-tight",
                            value === opt
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                        )}
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );

    const SelectField = ({ label, value, field, options }: { label: string, value: any, field: keyof LabUrine, options: string[] }) => (
        <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
            <select
                value={value || ''}
                onChange={(e) => onChange({ ...values, [field]: e.target.value })}
                className="w-full h-8 p-1.5 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-yellow-400 text-[11px] font-medium"
            >
                <option value="">Seçiniz</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );

    const SectionHeader = ({ icon: Icon, title, colorClass = "text-yellow-600" }: any) => (
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-yellow-100">
            <Icon className={cn("w-4 h-4", colorClass)} />
            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide">{title}</h3>
        </div>
    );

    // Local states for large text areas
    const [localSediment, setLocalSediment] = useState(values.sediment || '');
    const [localNotes, setLocalNotes] = useState(values.notlar || '');
    const [localAntibiotic, setLocalAntibiotic] = useState(values.antibiyotik || '');

    useEffect(() => { setLocalSediment(values.sediment || ''); }, [values.sediment]);
    useEffect(() => { setLocalNotes(values.notlar || ''); }, [values.notlar]);
    useEffect(() => { setLocalAntibiotic(values.antibiyotik || ''); }, [values.antibiyotik]);

    return (
        <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            {/* Kimyasal İnceleme */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <SectionHeader icon={FlaskConical} title="Kimyasal İnceleme (Strip)" colorClass="text-emerald-600" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                    <div className="grid grid-cols-2 gap-2">
                        <InputField label="Dansite (SG)" value={values.dansite} field="dansite" placeholder="1.020" />
                        <SelectField label="pH" value={values.ph} field="ph" options={['5.5', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0']} />
                    </div>

                    <QuickSelectField label="Protein" value={values.protein} field="protein" options={['Negatif', 'Eser', '+1', '+2', '+3', '+4']} />
                    <QuickSelectField label="Glukoz" value={values.glukoz} field="glukoz" options={['Negatif', 'Normal', '+1', '+2', '+3', '+4']} />
                    <QuickSelectField label="Keton" value={values.keton} field="keton" options={['Negatif', 'Eser', '+1', '+2', '+3', '+4']} />
                    <QuickSelectField label="Bilirubin" value={values.bilirubin} field="bilirubin" options={['Negatif', '+1', '+2', '+3']} />
                    <QuickSelectField label="Ürobilinojen" value={values.urobilinojen} field="urobilinojen" options={['Normal', '+1', '+2', '+3']} />
                    <QuickSelectField label="Nitrit" value={values.nitrit} field="nitrit" options={['Negatif', 'Pozitif']} />
                    <QuickSelectField label="Lökosit Esteraz" value={values.lokosit_esteraz} field="lokosit_esteraz" options={['Negatif', 'Eser', '+1', '+2', '+3']} />
                    <QuickSelectField label="Kan / Hemoglobin" value={values.kan} field="kan" options={['Negatif', 'Eser', '+1', '+2', '+3']} />
                </div>
            </div>

            {/* Mikroskobik İnceleme */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <SectionHeader icon={Microscope} title="Mikroskobik İnceleme (Sediment)" colorClass="text-yellow-600" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-6">
                    <InputField label="Lökosit" suffix="/HPF" value={values.mik_lokosit} field="mik_lokosit" />
                    <InputField label="Eritrosit" suffix="/HPF" value={values.mik_eritrosit} field="mik_eritrosit" />
                    <InputField label="Epitel" value={values.mik_epitel} field="mik_epitel" />
                    <SelectField
                        label="Bakteri"
                        value={values.mik_bakteri}
                        field="mik_bakteri"
                        options={['Görülmedi', 'Nadiren', 'Az', 'Orta', 'Bol']}
                    />
                    <InputField label="Kristaller" value={values.mik_kristaller} field="mik_kristaller" />
                    <InputField label="Silindirler" value={values.mik_silindirler} field="mik_silindirler" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detaylı Sediment Notu / Eski Sistem</Label>
                    <Textarea
                        value={localSediment}
                        onChange={e => setLocalSediment(e.target.value)}
                        onBlur={() => onChange({ ...values, sediment: localSediment })}
                        className="h-16 text-[11px] bg-slate-50 border-slate-200 resize-none font-medium"
                        placeholder="Örn: Her sahada 3-4 lökosit, nadir epitel görüldü..."
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Kültür Bölümü */}
                <div className="lg:col-span-12 bg-white rounded-xl border-t-4 border-t-red-400 shadow-sm p-5">
                    <SectionHeader icon={Beaker} title="İdrar Kültürü" colorClass="text-red-600" />
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4 space-y-4">
                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Kültür Sonucu</Label>
                                <Select value={values.kultur || ''} onValueChange={v => onChange({ ...values, kultur: v })}>
                                    <SelectTrigger className="h-8 text-[11px] font-medium bg-slate-50 border-slate-200">
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ureme_yok">Üreme Olmadı</SelectItem>
                                        <SelectItem value="ureme_var">Üreme Oldu</SelectItem>
                                        <SelectItem value="kontamine">Kontamine</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <InputField label="Koloni Sayısı" suffix="cfu/ml" value={values.koloni} field="koloni" />
                            <InputField label="Üreyen Bakteri" value={values.bakteri} field="bakteri" />
                        </div>
                        <div className="lg:col-span-8 flex flex-col gap-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Antibiyogram / Notlar</Label>
                            <Textarea
                                value={localAntibiotic}
                                onChange={e => setLocalAntibiotic(e.target.value)}
                                onBlur={() => onChange({ ...values, antibiyotik: localAntibiotic })}
                                className="flex-1 min-h-[120px] text-[11px] bg-slate-50 border-slate-200 resize-none font-medium"
                                placeholder="Duyarlı: ..., Dirençli: ..."
                            />
                        </div>
                    </div>
                </div>

                {/* Genel Notlar */}
                <div className="lg:col-span-12 bg-white rounded-xl border-l-4 border-l-slate-400 shadow-sm p-4">
                    <SectionHeader icon={FileText} title="Laboratuvar Genel Notları" colorClass="text-slate-500" />
                    <Textarea
                        value={localNotes}
                        onChange={e => setLocalNotes(e.target.value)}
                        onBlur={() => onChange({ ...values, notlar: localNotes })}
                        className="h-20 text-[11px] bg-slate-50 border-slate-200 resize-none font-medium"
                        placeholder="Ek tıbbi notlar..."
                    />
                </div>
            </div>

            {/* Geçmiş Sonuçlar */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-blue-500" />
                        <span>Geçmiş İdrar Tahlili Sonuçları</span>
                    </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                <th className="py-2 px-4 w-32 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onToggleSort('tarih')}>
                                    <div className="flex items-center gap-1">
                                        Tarih
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === 'tarih' ? "text-blue-600" : "text-slate-300")} />
                                    </div>
                                </th>
                                <th className="py-2 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onToggleSort('tetkik_adi')}>
                                    <div className="flex items-center gap-1">
                                        Tetkik
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === 'tetkik_adi' ? "text-blue-600" : "text-slate-300")} />
                                    </div>
                                </th>
                                <th className="py-2 px-4">Sonuç</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {historyData.map((lab: any) => (
                                <tr key={lab.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                                    <td className="py-2 px-4 font-mono text-slate-500">{lab.tarih ? format(parseISO(lab.tarih), 'dd.MM.yyyy') : '-'}</td>
                                    <td className="py-2 px-4 font-bold text-slate-700">{normalizeTestName(lab.tetkik_adi)}</td>
                                    <td className="py-2 px-4 font-bold text-blue-600 font-mono whitespace-pre-wrap">{lab.sonuc}</td>
                                </tr>
                            ))}
                            {historyData.length === 0 && (
                                <tr><td colSpan={3} className="p-4 text-center text-slate-400">Kayıt bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

interface SpermiogramSectionProps {
    values: Partial<LabSpermiogram>;
    onChange: (values: Partial<LabSpermiogram>) => void;
    historyData: any[];
    sortConfig: any;
    onToggleSort: (key: string) => void;
}

const SpermiogramSection = React.memo(({ values, onChange, historyData, sortConfig, onToggleSort }: SpermiogramSectionProps) => {

    // --- HELPER COMPONENT FOR INPUTS ---
    const InputField = ({ label, value, field, suffix, placeholder = "", type = "text", options }: { label: string, value: any, field: keyof LabSpermiogram, suffix?: string, placeholder?: string, type?: string, options?: string[] }) => {
        const [localVal, setLocalVal] = useState(value || '');

        // Sync with prop value when it changes (e.g., initial load or parent update)
        useEffect(() => { setLocalVal(value || ''); }, [value]);

        const handleBlur = () => {
            if (localVal !== (values[field] || '')) {
                onChange({ ...values, [field]: localVal });
            }
        };

        return (
            <div className="flex flex-col gap-1">
                <Label className="text-[11px] font-bold text-slate-500 uppercase truncate">{label}</Label>
                <div className="relative">
                    {options ? (
                        <select
                            value={localVal}
                            onChange={(e) => {
                                setLocalVal(e.target.value);
                                onChange({ ...values, [field]: e.target.value });
                            }}
                            className="w-full h-9 p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-xs font-medium appearance-none"
                        >
                            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    ) : (
                        <Input
                            type={type}
                            value={localVal}
                            onChange={(e) => setLocalVal(e.target.value)}
                            onBlur={handleBlur}
                            placeholder={placeholder}
                            className="w-full h-9 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all bg-slate-50 focus:bg-white text-xs font-medium pr-8"
                        />
                    )}
                    {suffix && <span className="absolute right-3 top-2.5 text-slate-400 text-[10px] font-bold pointer-events-none">{suffix}</span>}
                </div>
            </div>
        );
    };

    const SectionTitle = ({ icon: Icon, title, colorClass = "text-blue-600" }: any) => (
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Icon className={`w-4 h-4 ${colorClass}`} />
            <h3 className="font-bold text-xs text-slate-600 uppercase tracking-wide">{title}</h3>
        </div>
    );

    // Local State for Notes (TextArea)
    const [localNotes, setLocalNotes] = useState(values.notlar || '');
    useEffect(() => { setLocalNotes(values.notlar || ''); }, [values.notlar]);

    return (
        <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">

            {/* --- NEW FORM LAYOUT --- */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                    <div>
                        <h1 className="text-lg font-bold flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-blue-400" />
                            Semen Analiz Rapor Formu
                        </h1>
                        <p className="text-slate-400 text-[10px] mt-0.5">Hibrit Hareketlilik Değerlendirme Paneli</p>
                    </div>
                    <div className="hidden sm:block text-right">
                        <p className="text-[10px] opacity-60 italic">Tarih: {values.tarih || format(new Date(), 'dd.MM.yyyy')}</p>
                    </div>
                </div>

                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Makroskobik İnceleme */}
                        <section className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:border-blue-200 transition-colors">
                            <SectionTitle icon={Droplets} title="Makroskobik İnceleme" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField label="Volüm (Hacim)" field="volum" value={values.volum} suffix="mL" type="number" placeholder="≥ 1.4" />
                                <InputField label="pH" field="ph" value={values.ph} type="number" placeholder="≥ 7.2" />
                                <InputField label="Vizkozite" field="viskozite" value={values.viskozite || 'Normal'} options={['Normal', 'Artmış (+)', 'Çok Artmış (++)']} />
                                <InputField label="Likefaksiyon" field="likefaksiyon" value={values.likefaksiyon || 'Normal (30 dk)'} options={['Normal (30 dk)', 'Uzamış (> 60 dk)', 'Eksik']} />
                            </div>
                        </section>

                        {/* Sperm Sayımı */}
                        <section className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:border-emerald-200 transition-colors">
                            <SectionTitle icon={Microscope} title="Sperm Sayımı" colorClass="text-emerald-600" />
                            <div className="grid grid-cols-1 gap-4">
                                <InputField label="Sperm Konsantrasyonu" field="konsantrasyon" value={values.konsantrasyon} suffix="mil/mL" type="number" placeholder="≥ 16" />
                                <InputField label="Toplam Sperm Sayısı" field="total_sperm_sayisi" value={values.total_sperm_sayisi} suffix="milyon" type="number" placeholder="≥ 39" />
                            </div>
                        </section>
                    </div>

                    {/* Hareketlilik Alanları */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Yeni Sistem Hareketlilik (WHO) */}
                        <section className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 shadow-sm hover:border-indigo-300 transition-colors">
                            <SectionTitle icon={Zap} title="Yeni Sistem Hareketlilik (WHO)" colorClass="text-indigo-600" />
                            <div className="grid grid-cols-3 gap-4">
                                <InputField label="Progresif (PR)" field="motilite_pr" value={values.motilite_pr} suffix="%" type="number" placeholder="≥ 30" />
                                <InputField label="Yerinde (NP)" field="motilite_np" value={values.motilite_np} suffix="%" type="number" />
                                <InputField label="Hareketsiz (IM)" field="motilite_im" value={values.motilite_im} suffix="%" type="number" />
                            </div>
                        </section>

                        {/* Eski Sistem Hareketlilik */}
                        <section className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 shadow-sm hover:border-blue-300 transition-colors">
                            <SectionTitle icon={Activity} title="Eski Sistem Hareketlilik" colorClass="text-blue-600" />
                            <div className="grid grid-cols-4 gap-2">
                                <InputField label="+4" field="motilite_4" value={values.motilite_4} suffix="%" type="number" />
                                <InputField label="+3" field="motilite_3" value={values.motilite_3} suffix="%" type="number" />
                                <InputField label="+2" field="motilite_2" value={values.motilite_2} suffix="%" type="number" />
                                <InputField label="+1" field="motilite_1" value={values.motilite_1} suffix="%" type="number" />
                            </div>
                        </section>
                    </div>

                    {/* Morfoloji */}
                    <section className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
                        <SectionTitle icon={Activity} title="Morfoloji Değerlendirmesi" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                            <div className="flex flex-col gap-1">
                                <Label className="text-[11px] font-bold text-blue-700 italic uppercase">Normal Morfoloji</Label>
                                <select
                                    className="w-full h-9 p-2 border-2 border-blue-200 rounded-lg bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-blue-800"
                                    value={values.morfoloji || '4'}
                                    onChange={(e) => onChange({ ...values, morfoloji: e.target.value })}
                                >
                                    {[1, 2, 3, 4, 5].map(num => (
                                        <option key={num} value={num}>% {num}</option>
                                    ))}
                                </select>
                            </div>
                            <InputField label="Baş Defektleri" field="morfoloji_bas" value={values.morfoloji_bas} suffix="%" type="number" />
                            <InputField label="Boyun/Ara Parça Def." field="morfoloji_boyun" value={values.morfoloji_boyun} suffix="%" type="number" />
                            <InputField label="Kuyruk Defektleri" field="morfoloji_kuyruk" value={values.morfoloji_kuyruk} suffix="%" type="number" />
                        </div>
                    </section>

                    {/* Notlar */}
                    <section>
                        <SectionTitle icon={FileText} title="Laboratuvar Notları" />
                        <Textarea
                            value={localNotes}
                            onChange={e => setLocalNotes(e.target.value)}
                            onBlur={() => onChange({ ...values, notlar: localNotes })}
                            placeholder="Ek gözlemler, agregasyon veya aglütinasyon durumu..."
                            className="h-24 text-xs bg-slate-50 border-slate-200 resize-none rounded-xl focus:bg-white transition-colors p-4"
                        />
                    </section>
                </div>

                <div className="bg-slate-50 p-3 px-6 text-[10px] text-slate-400 flex justify-between border-t border-slate-200">
                    <span>* PR: Progresif Hareket, NP: Yerinde Hareket, IM: Hareketsiz</span>
                    <span>WHO 6. Edisyon & Klasik Klasifikasyon</span>
                </div>
            </div>

            {/* --- OLD HISTORY TABLE (KEPT) --- */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                    <span>Geçmiş Semen Analizi Sonuçları</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                <th className="py-2 px-4 w-32 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onToggleSort('tarih')}>
                                    <div className="flex items-center gap-1">
                                        Tarih
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === 'tarih' ? "text-blue-600" : "text-slate-300")} />
                                    </div>
                                </th>
                                <th className="py-2 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onToggleSort('tetkik_adi')}>
                                    <div className="flex items-center gap-1">
                                        Tetkik
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === 'tetkik_adi' ? "text-blue-600" : "text-slate-300")} />
                                    </div>
                                </th>
                                <th className="py-2 px-4">Sonuç</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {historyData.map((lab: any) => (
                                <tr key={lab.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                                    <td className="py-2 px-4 font-mono text-slate-500">{lab.tarih ? format(parseISO(lab.tarih), 'dd.MM.yyyy') : '-'}</td>
                                    <td className="py-2 px-4 font-bold text-slate-700">{normalizeTestName(lab.tetkik_adi)}</td>
                                    <td className="py-2 px-4 font-bold text-blue-600 font-mono whitespace-pre-wrap">{lab.sonuc}</td>
                                </tr>
                            ))}
                            {historyData.length === 0 && (
                                <tr><td colSpan={3} className="p-4 text-center text-slate-400">Kayıt yok.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

interface UroflowmetriSectionProps {
    values: Partial<LabUroflowmetriCreate>;
    onChange: (values: Partial<LabUroflowmetriCreate>) => void;
    onFileChange: (file: File | null) => void;
    historyData: LabUroflowmetri[];
    sortConfig: any;
    onToggleSort: (key: string) => void;
    onViewPdf: (url: string) => void;
    onDelete: (id: number) => void;
    authToken?: string | null;
}

const UroflowmetriSection = React.memo(({ values, onChange, onFileChange, historyData, sortConfig, onToggleSort, onViewPdf, onDelete, authToken }: UroflowmetriSectionProps) => {
    const [localComment, setLocalComment] = useState(values.comment || '');
    useEffect(() => { setLocalComment(values.comment || ''); }, [values.comment]);



    return (
        <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-xl border-t-4 border-t-cyan-500 shadow-sm p-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Üroflowmetri Analizi</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <LabInput label="QMax" unit="ml/s" value={values.qmax} onFieldChange={(v: string) => onChange({ ...values, qmax: v as any })} />
                    <LabInput label="Ortalama" unit="ml/s" value={values.average_flow} onFieldChange={(v: string) => onChange({ ...values, average_flow: v as any })} />
                    <LabInput label="Hacim" unit="ml" value={values.volume} onFieldChange={(v: string) => onChange({ ...values, volume: v as any })} />
                    <LabInput label="Rezidüel" unit="ml" value={values.residual_urine} onFieldChange={(v: string) => onChange({ ...values, residual_urine: v as any })} />
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Yorum</Label>
                        <Textarea
                            value={localComment}
                            onChange={e => setLocalComment(e.target.value)}
                            onBlur={() => onChange({ ...values, comment: localComment })}
                            className="h-[80px] text-xs bg-slate-50 border-slate-200 resize-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">PDF Sonuç Yükle</Label>
                        <Input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                            className="text-xs bg-slate-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                    <span>Geçmiş Üroflowmetri Sonuçları</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                <th className="py-2 px-4 w-32 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onToggleSort('tarih')}>
                                    <div className="flex items-center gap-1">
                                        Tarih
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === 'tarih' ? "text-blue-600" : "text-slate-300")} />
                                    </div>
                                </th>
                                <th className="py-2 px-4">QMax (ml/s)</th>
                                <th className="py-2 px-4">Ort (ml/s)</th>
                                <th className="py-2 px-4">Vol (ml)</th>
                                <th className="py-2 px-4">Res (ml)</th>
                                <th className="py-2 px-4">Yorum</th>
                                <th className="py-2 px-4 w-12 text-center">PDF</th>
                                <th className="py-2 px-4 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {historyData.map((lab: LabUroflowmetri) => (
                                <tr key={lab.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                                    <td className="py-2 px-4 font-mono text-slate-500">{lab.tarih ? format(parseISO(lab.tarih), 'dd.MM.yyyy') : '-'}</td>
                                    <td className="py-2 px-4 font-bold text-slate-700">{lab.qmax}</td>
                                    <td className="py-2 px-4 text-slate-600">{lab.average_flow}</td>
                                    <td className="py-2 px-4 text-slate-600">{lab.volume}</td>
                                    <td className="py-2 px-4 text-slate-600">{lab.residual_urine}</td>
                                    <td className="py-2 px-4 text-slate-500 truncate max-w-[200px]" title={lab.comment || ''}>{lab.comment}</td>
                                    <td className="py-2 px-4 text-center">
                                        {lab.pdf_url && (
                                            <button
                                                onClick={() => {
                                                    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/lab/uroflowmetri/${lab.id}/download?token=${authToken}`;
                                                    onViewPdf(url);
                                                }}
                                                className="text-blue-600 hover:text-blue-800 transition-colors inline-block"
                                                title="PDF Görüntüle"
                                            >
                                                <FileIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button className="text-red-500 hover:text-red-700 transition-colors inline-block" title="Sil">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Kayıt Silinecek</AlertDialogTitle>
                                                    <AlertDialogDescription>Bu işlem geri alınamaz. Devam etmek istiyor musunuz?</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDelete(lab.id)} className="bg-red-600 text-white hover:bg-red-700">Sil</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </td>
                                </tr>
                            ))}
                            {historyData.length === 0 && (
                                <tr><td colSpan={8} className="p-4 text-center text-slate-400">Kayıt yok.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

export default function LabPage() {
    const params = useParams();
    const patientId = String(params.id);
    const queryClient = useQueryClient();
    const { token: authToken } = useAuthStore();

    // -- Global State --
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [activeTab, setActiveTab] = useState("biochemistry");

    // Order Sets Definition
    const ORDER_SETS = {
        "Hemogram Paneli": ["Lökosit (WBC)", "Hemoglobin (HGB)", "Hematokrit (HCT)", "Trombosit (PLT)"],
        "Böbrek Fonksiyon": ["Üre (BUN)", "Kreatinin", "eGFR", "Sodyum (Na)", "Potasyum (K)", "Klor (Cl)", "Kalsiyum (Ca)"],
        "Prostat Sağlığı": ["PSA (Total)", "PSA (Serbest)", "Serbest/Total PSA Oranı"],
        "Androloji & Hormon": ["Testosteron (Total)", "Testosteron (Serbest)", "SHBG", "LH", "FSH", "Prolaktin (PRL)", "TSH", "Estradiol (E2)"],
        "Metabolik Taş": ["Kalsiyum (Ca)", "Ürik Asit", "Fosfor (P)", "PTH", "Albümin"],
        "Enfeksiyon": ["Hemogram", "CRP", "Sedimantasyon", "Prokalsitonin"]
    };

    const applyOrderSet = (setName: keyof typeof ORDER_SETS) => {
        const tests = ORDER_SETS[setName];
        const newRows = tests.map((test, index) => ({
            id: Date.now() + index,
            test: test,
            result: '',
            unit: '',
            reference: ''
        }));
        // Append empty row at end
        newRows.push({ id: Date.now() + tests.length, test: '', result: '', unit: '', reference: '' });
        setFastLabRows(newRows);
        toast.success(`${setName} paketi uygulandı.`);
    };

    // -- Tab: Biyokimya --
    // -- Tab: Biyokimya (Fast Lab Entry) --
    // const [bioValues, setBioValues] = useState<Partial<LabBiochemistry>>({}); // Deprecated state for old panels
    interface FastLabRow {
        id: number;
        test: string;
        result: string;
        unit: string;
        reference: string;
        date?: string;
    }
    const [fastLabRows, setFastLabRows] = useState<FastLabRow[]>([{ id: 1, test: '', result: '', unit: '', reference: '' }, { id: 2, test: '', result: '', unit: '', reference: '' }]);
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<number[]>([]);

    // AI Lab Analysis State
    const [isLabAnalysisOpen, setIsLabAnalysisOpen] = useState(false);

    // Handle AI Analysis Result Application
    const handleApplyLabAnalysis = React.useCallback((results: any[], reportDate?: string) => {
        const newRows = results.map((item, index) => ({
            id: Date.now() + index, // Generate unique temp ID
            test: normalizeTestName(item.test_name),
            result: item.result_value,
            unit: item.unit || '',
            reference: item.reference_range || '',
            date: reportDate || (date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
        }));

        setFastLabRows(prev => [...prev, ...newRows]);
        toast.success(`${newRows.length} sonuç listeye eklendi.`);
        if (activeTab !== 'biochemistry') {
            setActiveTab('biochemistry');
        }
    }, [date, activeTab]);

    const [historySearch, setHistorySearch] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'tarih', direction: 'desc' });

    const toggleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    // Fetch Labs
    // In a real app, create separate queries or one big query. For now separate.
    const labsQuery = useQuery({
        queryKey: ['labs', patientId, activeTab],
        queryFn: () => api.clinical.getLabs(patientId, activeTab),
        enabled: activeTab !== 'biochemistry' && activeTab !== 'uroflowmetri', // Exclude new tabs
    });

    const genelLabsQuery = useQuery({
        queryKey: ['labs', patientId, 'genel'],
        queryFn: () => api.clinical.getLabs(patientId, 'genel'),
        enabled: activeTab === 'biochemistry' || activeTab === 'urine' || activeTab === 'spermiogram', // Enable generally for history tables
    });

    const sortItems = (items: any[]) => {
        if (!sortConfig) return items;
        return [...items].sort((a: any, b: any) => {
            if (sortConfig.key === 'tarih') {
                const dateA = a.tarih ? new Date(a.tarih).getTime() : 0;
                const dateB = b.tarih ? new Date(b.tarih).getTime() : 0;
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }
            if (sortConfig.key === 'tetkik_adi') {
                const valA = a.tetkik_adi || "";
                const valB = b.tetkik_adi || "";
                return sortConfig.direction === 'asc'
                    ? valA.localeCompare(valB, 'tr')
                    : valB.localeCompare(valA, 'tr');
            }
            return 0;
        });
    };

    const filteredLabs = useMemo(() => {
        if (!genelLabsQuery.data) return [];
        let filtered = genelLabsQuery.data;

        if (historySearch) {
            filtered = filtered.filter((lab: any) =>
                (lab.tetkik_adi || "").toLowerCase().includes(historySearch.toLowerCase())
            );
        }

        return sortItems(filtered);
    }, [genelLabsQuery.data, historySearch, sortConfig]);

    // Trend Chart States
    const [trendModalOpen, setTrendModalOpen] = useState(false);
    const [selectedTrendTest, setSelectedTrendTest] = useState<string | null>(null);

    const trendData = useMemo(() => {
        if (!selectedTrendTest || !genelLabsQuery.data) return [];
        return (genelLabsQuery.data as any[])
            .filter(l => l.tetkik_adi === selectedTrendTest)
            .map(l => ({
                date: l.tarih ? format(parseISO(l.tarih), 'dd.MM.yy') : '-',
                fullDate: l.tarih,
                value: parseFloat(String(l.sonuc || "").replace(',', '.')),
                originalResult: l.sonuc,
                unit: l.birim
            }))
            .filter(l => !isNaN(l.value))
            .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
    }, [selectedTrendTest, genelLabsQuery.data]);

    const handleDownloadChart = () => {
        if (trendData.length === 0) return;
        const headers = ["Tarih", "Test", "Sonuç", "Birim"];
        const rows = trendData.map(d => [d.fullDate, selectedTrendTest, d.originalResult, d.unit]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${selectedTrendTest}_trend.csv`);
        link.click();
    };

    const toggleHistorySelection = (id: number) => {
        setSelectedHistoryIds(prev =>
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };

    const toggleSelectAllHistory = () => {
        if (filteredLabs.length === 0) return;
        const allIds = filteredLabs.map((l: any) => l.id);
        if (selectedHistoryIds.length === allIds.length) {
            setSelectedHistoryIds([]);
        } else {
            setSelectedHistoryIds(allIds);
        }
    };

    const deleteHistoryMutation = useMutation({
        mutationFn: async () => {
            return api.clinical.deleteGenelLabBatch(selectedHistoryIds);
        },
        onSuccess: () => {
            toast.success(`${selectedHistoryIds.length} kayıt silindi.`);
            setSelectedHistoryIds([]);
            queryClient.invalidateQueries({ queryKey: ['labs', patientId] });
        },
        onError: () => {
            toast.error("Silme işlemi başarısız.");
        }
    });



    // Paste Parsing
    const [pasteText, setPasteText] = useState("");
    const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
    const parseMutation = useMutation({
        mutationFn: async (text: string) => {
            return api.clinical.parseLabText(text);
        },
        onSuccess: (data) => {
            // Helper function to normalize Turkish characters to English
            const normalizeTurkish = (str: string): string => {
                const turkishMap: Record<string, string> = {
                    'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
                    'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O',
                    'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
                };
                return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, char => turkishMap[char] || char);
            };

            // Updated Date if found
            if (data.report_date) {
                setDate(parseISO(data.report_date));
            }

            // Populate Rows
            if (data.results && data.results.length > 0) {
                const newRows = data.results.map((res: any, index: number) => ({
                    id: Date.now() + index,
                    test: normalizeTurkish(res.test_name).toUpperCase(), // Normalize Turkish chars and uppercase
                    result: res.value.toString(),
                    unit: res.unit || '',
                    reference: res.reference_range || '',
                    date: res.date || undefined
                }));
                // Always add an empty row at end
                newRows.push({ id: Date.now() + data.results.length, test: '', result: '', unit: '', reference: '', date: undefined });
                setFastLabRows(newRows);
                setIsPasteDialogOpen(false);
                setPasteText("");
                toast.success(`${data.results.length} test ayrıştırıldı.`);
            } else {
                toast.warning("Test bulunamadı.");
            }
        },
        onError: () => {
            toast.error("Ayrıştırma başarısız.");
        }
    });

    const handlePasteAnalysis = () => {
        if (!pasteText.trim()) return;
        parseMutation.mutate(pasteText);
    };

    // PDF Import
    const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfParseError, setPdfParseError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const pdfParseMutation = useMutation({
        mutationFn: async (file: File) => {
            return api.clinical.parseLabPdf(file);
        },
        onSuccess: async (data) => {
            if (!data.success) {
                setPdfParseError(data.message);
                return;
            }

            // Set date if found
            if (data.report_date) {
                try {
                    setDate(parseISO(data.report_date));
                } catch (e) { }
            }

            // Populate rows
            if (data.results && data.results.length > 0) {
                // Helper function to normalize Turkish characters to English
                const normalizeTurkish = (str: string): string => {
                    const turkishMap: Record<string, string> = {
                        'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
                        'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O',
                        'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
                    };
                    return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, char => turkishMap[char] || char);
                };

                const newRows = data.results.map((res: any, index: number) => ({
                    id: Date.now() + index,
                    test: normalizeTurkish(res.test_name).toUpperCase(),
                    result: res.value?.toString() || '',
                    unit: res.unit || '',
                    reference: res.reference || '',
                    date: data.report_date || undefined
                }));
                newRows.push({ id: Date.now() + data.results.length, test: '', result: '', unit: '', reference: '', date: undefined });
                setFastLabRows(newRows);

                // Upload PDF to document archive
                if (pdfFile && patient) {
                    try {
                        const uploadRes = await api.documents.upload(pdfFile);
                        await api.documents.create({
                            hasta_id: patientId,
                            tarih: format(date || new Date(), 'yyyy-MM-dd'),
                            kategori: 'Laboratuvar',
                            dosya_tipi: 'PDF',
                            dosya_adi: uploadRes.filename || 'Lab Sonuçları.pdf',
                            dosya_yolu: uploadRes.url,
                            aciklama: `PDF'ten aktarılan lab sonuçları (${data.results.length} test)`
                        });
                        toast.success(`${data.results.length} test ayrıştırıldı ve PDF belge arşivine kaydedildi.`);
                    } catch (uploadErr) {
                        toast.success(`${data.results.length} test ayrıştırıldı. (PDF arşivlenemedi)`);
                    }
                } else {
                    toast.success(`${data.results.length} test ayrıştırıldı.`);
                }

                setIsPdfDialogOpen(false);
                setPdfFile(null);
                setPdfParseError(null);
            } else {
                setPdfParseError("PDF'de tanınabilir lab sonucu bulunamadı.");
            }
        },
        onError: (error: any) => {
            setPdfParseError(error.message || "PDF işlenirken bir hata oluştu.");
        }
    });

    const handlePdfImport = () => {
        if (!pdfFile) return;
        setPdfParseError(null);
        pdfParseMutation.mutate(pdfFile);
    };

    const handlePrint = () => {
        if (selectedHistoryIds.length === 0) {
            toast.error("Lütfen yazdırmak için listeden en az bir kayıt seçiniz.");
            return;
        }

        const ids = selectedHistoryIds.join(',');
        window.open(`/print/lab/batch?ids=${ids}`, "_blank");
    };

    const handleFastLabChange = (id: number, field: keyof FastLabRow, value: string) => {
        setFastLabRows(prev => {
            const newRows = prev.map(row => row.id === id ? { ...row, [field]: value } : row);

            // Auto-add row if typing in the last row
            const lastRow = newRows[newRows.length - 1];
            if (lastRow.id === id && value !== '') {
                // Check if we already added a new empty row (prevent double add)
                // Or just keep it simple: always ensure one empty row at bottom?
                // The logic in HTML was: if typing in last row, add new one.
                // In React, we can check if the modified row is the last one.
                // Or just keep it simple: always ensure one empty row at bottom?
                // The logic in HTML was: if typing in last row, add new one.
                // In React, we can check if the modified row is the last one.
                return [...newRows, { id: Date.now(), test: '', result: '', unit: '', reference: '' }];
            }
            return newRows;
        });
    };

    const removeFastLabRow = (id: number) => {
        if (fastLabRows.length <= 1) {
            setFastLabRows([{ id: Date.now(), test: '', result: '', unit: '', reference: '' }]);
            return;
        }
        setFastLabRows(prev => prev.filter(row => row.id !== id));
    };

    const handleFastLabKeyDown = (e: React.KeyboardEvent, id: number, field: keyof FastLabRow) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (field === 'test') {
                document.getElementById(`result-${id}`)?.focus();
            } else if (field === 'result') {
                document.getElementById(`unit-${id}`)?.focus();
            } else if (field === 'unit') {
                document.getElementById(`reference-${id}`)?.focus();
            } else if (field === 'reference') {
                const index = fastLabRows.findIndex(r => r.id === id);
                if (index === fastLabRows.length - 1) {
                    // Last row, add new
                    setFastLabRows(prev => [...prev, { id: Date.now(), test: '', result: '', unit: '', reference: '' }]);
                    // Focus logic is tricky in React render cycle, use setTimeout
                    setTimeout(() => {
                        const newRows = document.querySelectorAll('input[id^="name-"]');
                        if (newRows.length > 0) (newRows[newRows.length - 1] as HTMLInputElement).focus();
                    }, 50);
                } else {
                    // Move to next row
                    const nextRowId = fastLabRows[index + 1].id;
                    document.getElementById(`name-${nextRowId}`)?.focus();
                }
            }
        }
        // Arrow navigation could be added here similar to HTML version
    };

    // -- Tab: Hemogram --
    const [hemoValues, setHemoValues] = useState<Partial<LabHemogram>>({});

    // -- Tab: Idrar --
    const [urineValues, setUrineValues] = useState<Partial<LabUrine>>({});

    // -- Tab: Spermiogram --
    const [spermValues, setSpermValues] = useState<Partial<LabSpermiogram>>({});

    // -- Tab: TRUS & Biopsi --
    const [trusValues, setTrusValues] = useState<Partial<LabTrusBiopsy>>({});
    const [biopsyDate, setBiopsyDate] = useState<Date | undefined>();
    // Checkboxes helpers
    const [pathologyChecks, setPathologyChecks] = useState<string[]>([]);
    const [tumorChecks, setTumorChecks] = useState<string[]>([]);

    // -- Tab: Uroflowmetri --
    const [uroflowValues, setUroflowValues] = useState<Partial<LabUroflowmetriCreate>>({});
    const [uroflowFile, setUroflowFile] = useState<File | null>(null);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [selectedUroflowId, setSelectedUroflowId] = useState<number | null>(null);

    // Fetch Patient
    const { data: patient } = useQuery({
        queryKey: ['patient', patientId],
        queryFn: () => api.patients.get(patientId),
    });


    // Fetch Definitions
    const definitionsQuery = useQuery({
        queryKey: ['system-definitions'],
        queryFn: () => api.settings.getAll(),
    });

    const trusTemplates = useMemo(() => {
        if (!definitionsQuery.data) return [];
        const defs = definitionsQuery.data.find((d: any) => d.key === 'system_definitions');
        if (!defs || !defs.value) return [];
        try {
            const parsed = JSON.parse(defs.value);
            return parsed['TRUS Biyopsi Şablonu'] || [];
        } catch (e) {
            return [];
        }
    }, [definitionsQuery.data]);


    const uroflowQuery = useQuery({
        queryKey: ['uroflowmetri', patientId],
        queryFn: () => api.clinical.getUroflowmetri(patientId),
        enabled: activeTab === 'uroflowmetri',
    });

    const imagingsQuery = useQuery({
        queryKey: ['imagings', patientId],
        queryFn: () => api.clinical.getImagings(patientId),
    });

    // Mutations
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!date) throw new Error("Tarih gerekli");
            const baseData = {
                hasta_id: patientId,
                tarih: format(date, 'yyyy-MM-dd'),
            };

            let payload: any = {};
            let type = activeTab;

            if (type === 'biochemistry') {
                // payload = { ...baseData, ...bioValues };
                // Use Fast Lab Rows
                const rowsToSave = fastLabRows.filter(r => r.test.trim() !== '');
                if (rowsToSave.length === 0) throw new Error("Kaydedilecek veri yok");

                const batchPayload = rowsToSave.map(row => ({
                    hasta_id: patientId,
                    tarih: row.date || format(date, 'yyyy-MM-dd'),
                    tetkik_adi: row.test,
                    sonuc: row.result,
                    birim: row.unit,
                    referans_araligi: row.reference
                }));

                return api.clinical.createGenelLabBatch(batchPayload);

            } else if (type === 'hemogram') {
                payload = { ...baseData, ...hemoValues };
            } else if (type === 'urine') {
                // handle special wiring for urine culture combo if needed
                payload = { ...baseData, ...urineValues };
            } else if (type === 'spermiogram') {
                payload = { ...baseData, ...spermValues };
            } else if (type === 'trus_biopsy') {
                // Map tumor checks to locations if template exists
                const tumorLocations = tumorChecks.map(check => {
                    if (trusTemplates.length > 0) {
                        const found = trusTemplates.find((t: string) => t.startsWith(check + ' |'));
                        return found ? found : check;
                    }
                    return check;
                });

                const trusPayload = {
                    hasta_id: patientId,
                    tarih: biopsyDate ? format(biopsyDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                    psa_total: trusValues.psa_total,
                    rektal_tuse: trusValues.rektal_tuse,
                    mri_var: trusValues.mri_var,
                    mri_tarih: trusValues.mri_tarih,
                    mri_ozet: trusValues.mri_ozet,
                    pirads_lezyon_boyut: trusValues.pirads_lezyon_boyut,
                    pirads_lezyon_lokasyon: trusValues.pirads_lezyon_lokasyon,
                    // Store other legacy fields in prosedur_notu or handle differently if backend allows
                    prosedur_notu: [
                        trusValues.trus_bulgu ? `Bulgular: ${trusValues.trus_bulgu}` : '',
                        trusValues.trus_tani ? `Tanı: ${trusValues.trus_tani}` : '',
                        trusValues.prostat_volum ? `Volüm: ${trusValues.prostat_volum} cc` : '',
                        trusValues.mri_var ? `MRI: Var (PIRADS: ${trusValues.mri_ozet || '-'})` : '',
                        trusValues.pirads_lezyon_boyut ? `Lezyon Boyut: ${trusValues.pirads_lezyon_boyut}` : '',
                        trusValues.pirads_lezyon_lokasyon ? `Lezyon Lokasyon: ${trusValues.pirads_lezyon_lokasyon}` : '',
                        `Patoloji: ${pathologyChecks.join(', ')}`,
                        `Tümörlü Alanlar: ${tumorLocations.join(', ')}`
                    ].filter(Boolean).join('\n'),
                    lokasyonlar: JSON.stringify([]) // TODO: Future enhancement for per-core data
                };
                return api.clinical.createTrusBiopsy(trusPayload as any);
            } else if (type === 'uroflowmetri') {
                let pdfUrl = '';
                if (uroflowFile) {
                    const uploadRes = await api.documents.upload(uroflowFile);
                    pdfUrl = uploadRes.url;
                }

                const uroPayload = {
                    ...baseData,
                    ...uroflowValues,
                    qmax: uroflowValues.qmax ? Number(uroflowValues.qmax) : undefined,
                    average_flow: uroflowValues.average_flow ? Number(uroflowValues.average_flow) : undefined,
                    volume: uroflowValues.volume ? Number(uroflowValues.volume) : undefined,
                    residual_urine: uroflowValues.residual_urine ? Number(uroflowValues.residual_urine) : undefined,
                    pdf_url: pdfUrl || undefined
                };
                return api.clinical.createUroflowmetri(uroPayload as any);
            }

            return api.clinical.createLab(type, payload);
        },
        onSuccess: (data) => {
            toast.success("Kayıt Başarılı");
            queryClient.invalidateQueries({ queryKey: ['labs', patientId] });

            if (activeTab === 'uroflowmetri') {
                queryClient.invalidateQueries({ queryKey: ['uroflowmetri', patientId] });
                setUroflowValues({});
                setUroflowFile(null);
            }

            if (activeTab === 'trus_biopsy') {
                setTrusValues((prev) => ({ ...prev, id: data.id }));
            }

            // Clear fast lab rows after save? Maybe keep empty ones.
            if (activeTab === 'biochemistry') {
                setFastLabRows([{ id: Date.now(), test: '', result: '', unit: '', reference: '' }, { id: Date.now() + 1, test: '', result: '', unit: '', reference: '' }]);
            }
        },
        onError: () => {
            toast.error("Kayıt Başarısız");
        }
    });

    const uroflowDeleteMutation = useMutation({
        mutationFn: (id: number) => api.clinical.deleteUroflowmetri(id),
        onSuccess: () => {
            toast.success("Kayıt silindi");
            queryClient.invalidateQueries({ queryKey: ['uroflowmetri', patientId] });
        },
        onError: () => toast.error("Silme başarısız")
    });

    const getOrderSetStyle = (index: number) => {
        const styles = [
            "text-red-600 border-red-300 hover:bg-red-50",       // Hemogram
            "text-amber-600 border-amber-300 hover:bg-amber-50", // Böbrek
            "text-blue-600 border-blue-300 hover:bg-blue-50",    // Prostat
            "text-purple-600 border-purple-300 hover:bg-purple-50", // Androloji
            "text-emerald-600 border-emerald-300 hover:bg-emerald-50", // Metabolik
            "text-rose-600 border-rose-300 hover:bg-rose-50",    // Enfeksiyon
        ];
        return styles[index % styles.length];
    };

    // Keyboard Shortcuts
    useKeyboardShortcuts({
        onSave: () => {
            if (!saveMutation.isPending) saveMutation.mutate();
        }
    });

    return (
        <div className="flex h-full flex-col gap-6 p-6 bg-slate-50/50 min-h-screen">
            {/* Header */}
            <PatientHeader patient={patient ?? null} moduleName="Laboratuvar Sonuçları" />

            {/* Tabs & Main Content */}
            <div className="space-y-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                    <TabsList className="w-full justify-start h-12 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                        <TabsTrigger value="biochemistry" className="flex-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none text-xs font-bold uppercase tracking-wide">
                            LABORATUVAR
                        </TabsTrigger>
                        <TabsTrigger value="uroflowmetri" className="flex-1 data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-none text-xs font-bold uppercase tracking-wide">
                            Üroflowmetri
                        </TabsTrigger>
                        <TabsTrigger value="urine" className="flex-1 data-[state=active]:bg-yellow-50 data-[state=active]:text-yellow-700 data-[state=active]:shadow-none text-xs font-bold uppercase tracking-wide">
                            İdrar Analizi
                        </TabsTrigger>
                        <TabsTrigger value="spermiogram" className="flex-1 data-[state=active]:bg-pink-50 data-[state=active]:text-pink-700 data-[state=active]:shadow-none text-xs font-bold uppercase tracking-wide">
                            Semen Analizi
                        </TabsTrigger>
                        <TabsTrigger value="trus_biopsy" className="flex-1 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none text-xs font-bold uppercase tracking-wide">
                            TRUS & Biyopsi
                        </TabsTrigger>
                    </TabsList>



                    {/* Date Selection & Actions Header */}
                    <div className="bg-white rounded-xl border border-white p-3 shadow-sm flex items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">TARİH:</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-[180px] justify-start text-left font-normal border-slate-200 bg-slate-50 h-9 text-xs",
                                                !date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-3 w-3" />
                                            {date ? format(date, "dd.MM.yyyy", { locale: tr }) : <span>Seçiniz</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={tr} />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* PASTE Button */}
                            <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-2 text-slate-600 border-slate-300 hover:bg-white hover:text-blue-600 ml-2">
                                        <ClipboardList className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase">SONUÇ YAPIŞTIR</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>Laboratuvar Sonuçlarını Yapıştır</DialogTitle>
                                        <DialogDescription>
                                            Kopyaladığınız ham metni buraya yapıştırın. Sistem otomatik olarak test adlarını ve sonuçları ayrıştıracaktır.
                                        </DialogDescription>
                                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                            <span className="font-bold">⚠️ Uyarı:</span> Bu özellik <span className="font-bold">e-Nabız Doktor Modülü</span> verileri için optimize edilmiştir. Diğer kaynaklarda ayrıştırma hataları olabilir.
                                        </div>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <Textarea
                                            placeholder="Örnek: 
Sodyum: 141
Potasyum: 4.5
..."
                                            className="h-[300px] font-mono text-sm"
                                            value={pasteText}
                                            onChange={(e) => setPasteText(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsPasteDialogOpen(false)}>İptal</Button>
                                        <Button onClick={handlePasteAnalysis} disabled={parseMutation.isPending} className="bg-blue-600 text-white hover:bg-blue-700">
                                            {parseMutation.isPending ? "Analiz Ediliyor..." : "Ayrıştır ve Aktar"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {/* PDF IMPORT Button */}
                            {/* PDF IMPORT Button REPLACED WITH AI ANALYSIS */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 ml-2"
                                onClick={() => setIsLabAnalysisOpen(true)}
                            >
                                <BrainCircuit className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">AKILLI ANALİZ</span>
                            </Button>

                            <LabAnalysisDialog
                                open={isLabAnalysisOpen}
                                onOpenChange={setIsLabAnalysisOpen}
                                onApply={handleApplyLabAnalysis}
                            />

                            {/* Panel Buttons (2 Numara) */}

                        </div>

                        {/* Actions (Moved from 1 Numara) */}
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => saveMutation.mutate()}
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 uppercase text-xs tracking-wide shadow-sm"
                                disabled={saveMutation.isPending}
                            >
                                <Save className="h-3 w-3" />
                                {saveMutation.isPending ? 'Kaydediliyor...' : 'KAYDET'}
                            </Button>

                            {/* Delete Button for Selected History Items */}
                            {selectedHistoryIds.length > 0 && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            size="sm"
                                            className="h-8 bg-red-600 hover:bg-red-700 text-white font-bold gap-2 uppercase text-xs tracking-wide shadow-sm"
                                            disabled={deleteHistoryMutation.isPending}
                                        >
                                            <Trash2 className="h-3 w-3" /> ({selectedHistoryIds.length}) SİL
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Silmek istediğinize emin misiniz?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Bu işlem geri alınamaz. {selectedHistoryIds.length} adet kayıt kalıcı olarak silinecektir.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteHistoryMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">
                                                Evet, Sil
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}

                            <div className="h-6 w-px bg-slate-200 mx-2"></div>

                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                                title="Yazdır"
                                onClick={handlePrint}
                            >
                                <Printer className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* TAB CONTENT: BIOCHEMISTRY (Genel Lab) */}
                    <TabsContent value="biochemistry">
                        <BiochemistrySection
                            fastLabRows={fastLabRows}
                            onFastLabUpdate={handleFastLabChange}
                            onRemoveRow={removeFastLabRow}
                            onKeyDown={handleFastLabKeyDown}
                            orderSets={ORDER_SETS}
                            onApplyOrderSet={applyOrderSet as any}
                            historyData={filteredLabs}
                            historySearch={historySearch}
                            onHistorySearchChange={setHistorySearch}
                            sortConfig={sortConfig}
                            onToggleSort={toggleSort}
                            selectedHistoryIds={selectedHistoryIds}
                            onToggleHistorySelection={toggleHistorySelection}
                            onToggleSelectAllHistory={toggleSelectAllHistory}
                            onTrendClick={(testName: string) => {
                                setSelectedTrendTest(testName);
                                setTrendModalOpen(true);
                            }}
                            globalDate={date}
                        />
                    </TabsContent>


                    <Dialog open={trendModalOpen} onOpenChange={setTrendModalOpen}>
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <div className="flex items-center justify-between pr-8">
                                    <div>
                                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                            <LineChartIcon className="h-5 w-5 text-blue-500" />
                                            {selectedTrendTest} Gelişim Grafiği
                                        </DialogTitle>
                                        <DialogDescription className="text-xs mt-1">
                                            Zaman bazlı sonuç değişimi ve trend analizi.
                                        </DialogDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2 border-slate-200 text-slate-600 hover:text-blue-600"
                                        onClick={handleDownloadChart}
                                    >
                                        <Download className="h-4 w-4" />
                                        VERİLERİ İNDİR (CSV)
                                    </Button>
                                </div>
                            </DialogHeader>

                            <div className="h-[400px] w-full mt-4 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                                {trendData.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis
                                                dataKey="date"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#64748b', fontWeight: 500 }}
                                            />
                                            <YAxis
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#64748b', fontWeight: 500 }}
                                                domain={['auto', 'auto']}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                                                formatter={(value: any, name: any, props: any) => [
                                                    <span className="font-bold text-blue-600" key="res">{props.payload.originalResult} {props.payload.unit}</span>,
                                                    "Sonuç"
                                                ]}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#3b82f6"
                                                strokeWidth={3}
                                                dot={{ r: 5, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
                                                activeDot={{ r: 8, strokeWidth: 0 }}
                                                animationDuration={1000}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <Activity className="h-12 w-12 opacity-20" />
                                        <p className="text-sm italic">Grafik oluşturmak için en az 2 farklı tarihli sonuç gereklidir.</p>
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="sm:justify-start">
                                <p className="text-[10px] text-slate-400 font-medium italic">
                                    * Grafik değerleri sayısal verilere göre otomatik oluşturulmuştur.
                                </p>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* TAB CONTENT: HEMOGRAM */}
                    <TabsContent value="hemogram">
                        <HemogramSection
                            values={hemoValues}
                            onChange={setHemoValues}
                        />
                    </TabsContent>


                    {/* TAB CONTENT: URINE */}
                    <TabsContent value="urine">
                        <UrineSection
                            values={urineValues}
                            onChange={setUrineValues}
                            historyData={sortItems(genelLabsQuery.data?.filter((l: any) => l.tetkik_adi.startsWith('İdrar')) || [])}
                            sortConfig={sortConfig}
                            onToggleSort={toggleSort}
                        />
                    </TabsContent>

                    {/* TAB CONTENT: TRUS & BIOPSY */}
                    <TabsContent value="trus_biopsy">
                        <TrusBiopsySection
                            patientId={patientId}
                            values={trusValues}
                            onChange={setTrusValues}
                            biopsyDate={biopsyDate}
                            onBiopsyDateChange={setBiopsyDate}
                            pathologyChecks={pathologyChecks}
                            onPathologyChecksChange={setPathologyChecks}
                            tumorChecks={tumorChecks}
                            onTumorChecksChange={setTumorChecks}
                            historyData={sortItems(imagingsQuery.data?.filter((l: any) => l.tetkik_adi.includes('TRUS') || l.tetkik_adi.includes('Biyopsi')) || [])}
                            sortConfig={sortConfig}
                            onToggleSort={toggleSort}
                            trusTemplates={trusTemplates}
                        />
                    </TabsContent>


                    {/* TAB CONTENT: SPERMIOGRAM */}
                    <TabsContent value="spermiogram">
                        <SpermiogramSection
                            values={spermValues}
                            onChange={setSpermValues}
                            historyData={sortItems(genelLabsQuery.data?.filter((l: any) => l.tetkik_adi === 'Spermiogram' || l.tetkik_adi === 'Semen Analizi') || [])}
                            sortConfig={sortConfig}
                            onToggleSort={toggleSort}
                        />
                    </TabsContent>

                    {/* TAB CONTENT: UROFLOWMETRI */}
                    <TabsContent value="uroflowmetri">
                        <UroflowmetriSection
                            values={uroflowValues}
                            onChange={setUroflowValues}
                            onFileChange={setUroflowFile}
                            historyData={sortItems(uroflowQuery.data || [])}
                            sortConfig={sortConfig}
                            onToggleSort={toggleSort}
                            onViewPdf={(url) => setPdfPreviewUrl(url)}
                            onDelete={(id) => uroflowDeleteMutation.mutate(id)}
                            authToken={authToken}
                        />
                    </TabsContent>

                    {/* PDF Preview Dialog */}
                    <Dialog open={!!pdfPreviewUrl} onOpenChange={(open) => !open && setPdfPreviewUrl(null)}>
                        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden gap-0">
                            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
                                <h3 className="font-bold text-sm text-slate-700">PDF Önizleme</h3>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="h-8 text-xs gap-2" onClick={() => window.open(pdfPreviewUrl!, '_blank')}>
                                        <Printer className="h-3 w-3" />
                                        Yazdır / İndir
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => setPdfPreviewUrl(null)}>
                                        ✕
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 w-full bg-slate-100 p-0">
                                {pdfPreviewUrl && (
                                    <iframe src={pdfPreviewUrl} className="w-full h-full border-none" title="PDF Preview" />
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                </Tabs>
            </div>
        </div>
    );
}
