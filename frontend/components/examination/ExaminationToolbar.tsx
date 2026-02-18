"use client";

import React from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
    Calendar as CalendarIcon, Save,
    Printer, Trash2, Loader2, CheckCircle2, Edit,
    User, Mic
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ExaminationFormData } from "@/hooks/useExaminationPageLogic";

interface ExaminationToolbarProps {
    formData: ExaminationFormData;
    setFormData: React.Dispatch<React.SetStateAction<ExaminationFormData>>;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    isAutoSaving: boolean;
    selectedExamId: number | null;
    doctors: string[];
    onSave: () => void;

    onDelete: (e: any, id: number) => void;
}

export function ExaminationToolbar({
    formData,
    setFormData,
    isEditing,
    setIsEditing,
    isAutoSaving,
    selectedExamId,
    doctors,
    onSave,
    onDelete
}: ExaminationToolbarProps) {
    return (
        <div className="rounded-xl border border-white bg-white shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={"outline"} disabled={!isEditing} className={cn("justify-start text-left font-bold transition-all h-10 px-4 min-w-[180px]", formData.tarih ? "bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100" : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100", !isEditing && "opacity-80")}>
                            <CalendarIcon className={cn("mr-2 h-4 w-4", formData.tarih ? "text-slate-600" : "text-slate-400")} />
                            {formData.tarih ? <span>{format(formData.tarih, "d MMMM yyyy", { locale: tr })}</span> : <span>Tarih Seçin</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={formData.tarih} onSelect={(date) => setFormData(prev => ({ ...prev, tarih: date || undefined }))} initialFocus locale={tr} />
                    </PopoverContent>
                </Popover>

                <Select value={formData.doktor} onValueChange={(val) => setFormData(prev => ({ ...prev, doktor: val }))} disabled={!isEditing}>
                    <SelectTrigger className={cn("w-[220px] h-10 bg-slate-50 border-slate-200 font-bold text-slate-700", !isEditing && "opacity-80")}>
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <SelectValue placeholder="Doktor Seçiniz" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {doctors.map(doc => (<SelectItem key={doc} value={doc}>{doc}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-3">
                <Button className={cn("h-10 text-white font-bold text-sm px-6 gap-2 shadow-sm transition-all", !isEditing ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200")} onClick={() => isEditing ? onSave() : setIsEditing(true)}>
                    {isEditing ? <><Save className="h-4 w-4" /> KAYDET</> : <><Edit className="h-4 w-4" /> DÜZENLE</>}
                </Button>

                {selectedExamId && (
                    <Button variant="outline" className="h-10 w-10 p-0 rounded-lg border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700" onClick={() => window.open(`/print/examination/${selectedExamId}`, '_blank')}>
                        <Printer className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
