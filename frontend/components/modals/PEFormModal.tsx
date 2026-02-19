"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Activity, ClipboardCheck, Trash2, Send, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

interface PEOption {
    id: string;
    label: string;
    text: string;
    category: "batin" | "genital" | "anal" | "ego" | "genel" | "arap_pe";
}

const PE_OPTIONS: PEOption[] = [
    // BATIN
    { id: "batin-normal", label: "Batın Normal", text: "Batın rahat, defans ve rebound yok, operasyon skarı yok.", category: "batin" },
    { id: "batin-skar", label: "Op. Skarı Var", text: "Batında eski operasyon skarı mevcut.", category: "batin" },
    { id: "batin-distand", label: "Batın Distand", text: "Batın distand, barsak sesleri normoaktif.", category: "batin" },
    { id: "batin-herni", label: "İnguinal Herni", text: "İnguinal bölgede palpabl herni saptandı.", category: "batin" },

    // GENİTAL
    { id: "genital-normal", label: "Genital Normal", text: "Eksternal genital yapı doğal, her iki testis skrotumda.", category: "genital" },
    { id: "genital-varikosel-l", label: "Sol Varikosel", text: "Sol varikosel (grade 2-3) saptandı.", category: "genital" },
    { id: "genital-hidrosel", label: "Hidrosel", text: "Skrotal bölgede hidrosel ile uyumlu kitle palpasyonu.", category: "genital" },
    { id: "genital-hipospadias", label: "Hipospadias", text: "Erişkin tipi hipospadias meatusu gözlendi.", category: "genital" },
    { id: "genital-fimozis", label: "Fimozis", text: "İleri derecede fimozis saptandı.", category: "genital" },

    // ANAL / PROSTAT (Rektal Tuşe)
    { id: "anal-normal", label: "Rektal Tuşe Normal", text: "Anal sfinkter tonusu normal, prostat yaklaşık 20-25g, düzgün yüzeyli, sulkus açık.", category: "anal" },
    { id: "anal-bph", label: "BPH (Prostat)", text: "Prostat yaklaşık 40-50g, benign karakterde, sulkus kapalı.", category: "anal" },
    { id: "anal-nodul", label: "Sertlik/Nodül", text: "Prostat sağ/sol lobda şüpheli sertlik/nodül saptandı.", category: "anal" },
    { id: "anal-tonus-az", label: "Tonus Azalmış", text: "Anal sfinkter tonusu azalmış saptandı.", category: "anal" },

    // EGO (External Genital Organlar) / Penil
    { id: "ego-penil-normal", label: "Penis Normal", text: "Penis ve üretral meatus normal görünümde.", category: "ego" },
    { id: "ego-plak", label: "Peyronie Plağı", text: "Penis dorsalinde palpabl fibröz plak saptandı.", category: "ego" },
    { id: "ego-lesyon", label: "Genital Lezyon", text: "Penil ciltte şüpheli milimetrik lezyonlar/siğiller saptandı.", category: "ego" },

    // GENEL
    { id: "genel-kvah-neg", label: "KVAH (-/-)", text: "Kostovertebral açı hassasiyeti saptanmadı.", category: "genel" },
    { id: "genel-kvah-pos-r", label: "KVAH (+/-)", text: "Sağ kostovertebral açı hassasiyeti saptandı.", category: "genel" },
    { id: "genel-kvah-pos-l", label: "KVAH (-/+)", text: "Sol kostovertebral açı hassasiyeti saptandı.", category: "genel" },

    // ARAP PE (Ejaculation Dysfunction - Scientific Basis: EAU 2025 & UpToDate)
    { id: "arap-type-lifelong", label: "Yaşam Boyu (Lifelong)", text: "Yaşam boyu (lifelong) prematür ejakülasyon tablosu mevcut.", category: "arap_pe" },
    { id: "arap-type-acquired", label: "Edinsel (Acquired)", text: "Sonradan gelişen (acquired) prematür ejakülasyon tablosu mevcut.", category: "arap_pe" },
    { id: "arap-ielt-1", label: "IELT < 1 dk", text: "İntravajinal ejakülatuar latent süre (IELT) 1 dakikanın altında.", category: "arap_pe" },
    { id: "arap-ielt-1-3", label: "IELT 1-3 dk", text: "İntravajinal ejakülatuar latent süre (IELT) 1-3 dakika aralığında.", category: "arap_pe" },
    { id: "arap-control-none", label: "Kontrol: Yok", text: "Ejakülasyon üzerinde kontrol hissi saptanmadı (lack of control).", category: "arap_pe" },
    { id: "arap-control-lit", label: "Kontrol: Az/Zayıf", text: "Ejakülasyon üzerinde kontrol hissi zayıf/kısıtlı.", category: "arap_pe" },
    { id: "arap-dist-frust", label: "Belirgin Distress", text: "Ejakülatuvar disfonksiyona bağlı belirgin kişisel sıkıntı, hüsran (frustration) ve distres mevcut.", category: "arap_pe" },
    { id: "arap-inter-diff", label: "İlişkisel Zorluk", text: "Ejakülatuvar problemlere bağlı partner ilişkisinde belirgin zorluk (interpersonal difficulty) tariflenmekte.", category: "arap_pe" },
];

interface PEFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onExport: (text: string) => void;
}

export const PEFormModal: React.FC<PEFormModalProps> = ({ isOpen, onOpenChange, onExport }) => {
    const { examinationModules } = useSettingsStore();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const categories = useMemo(() => {
        const base = [
            { id: "genel", label: "Genel / KVAH", icon: <Activity className="w-4 h-4" /> },
            { id: "batin", label: "Batın", icon: <Activity className="w-4 h-4" /> },
            { id: "genital", label: "Genital (Testis/Skrotum)", icon: <Activity className="w-4 h-4" /> },
            { id: "ego", label: "Penil / Meatus", icon: <Activity className="w-4 h-4" /> },
            { id: "anal", label: "Rektal Tuşe (Anal/Prostat)", icon: <Activity className="w-4 h-4" /> },
        ];

        if (examinationModules.arapPEModule) {
            base.push({ id: "arap_pe", label: "Arap PE (Ejakülasyon)", icon: <Zap className="w-4 h-4" /> });
        }

        return base;
    }, [examinationModules.arapPEModule]);

    const toggleOption = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const generatedText = useMemo(() => {
        if (selectedIds.length === 0) return "";

        // Group by category to maintain flow
        const selectedOptions = PE_OPTIONS.filter(opt => selectedIds.includes(opt.id));
        const groupedText = selectedOptions.map(opt => opt.text).join(" ");

        return groupedText;
    }, [selectedIds]);

    const handleExport = () => {
        onExport(generatedText);
        setSelectedIds([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-none shadow-2xl">
                <DialogHeader className="p-6 bg-white border-b border-slate-100 shrink-0">
                    <DialogTitle className="flex items-center gap-3 text-xl font-black text-slate-800 uppercase tracking-tight">
                        <div className="p-2 bg-blue-600 rounded-lg text-white">
                            <ClipboardCheck className="w-6 h-6" />
                        </div>
                        Fizik Muayene (PE) Giriş Formu
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left: Options Selection */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white/50">
                        {categories.map(cat => (
                            <div key={cat.id} className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                                    <div className="p-1.5 bg-slate-100 rounded-md text-slate-600">
                                        {cat.icon}
                                    </div>
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                        {cat.label}
                                    </h4>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {PE_OPTIONS.filter(opt => opt.category === cat.id).map(opt => (
                                        <Button
                                            key={opt.id}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleOption(opt.id)}
                                            className={cn(
                                                "justify-start h-auto py-2.5 px-3 text-left font-medium transition-all border-slate-200 hover:border-blue-300 hover:bg-blue-50/50",
                                                selectedIds.includes(opt.id) && "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 shadow-md"
                                            )}
                                        >
                                            <span className="text-xs">{opt.label}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right: Preview & Actions */}
                    <aside className="w-full md:w-[340px] bg-slate-100/80 border-l border-slate-200 flex flex-col shrink-0">
                        <div className="p-4 border-b border-slate-200 bg-white/80">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                Oluşturulan Metin
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 font-mono">
                                    {selectedIds.length} Seçim
                                </Badge>
                            </h4>
                        </div>
                        <ScrollArea className="flex-1 p-6">
                            {generatedText ? (
                                <p className="text-sm font-medium text-slate-700 leading-relaxed font-mono bg-white p-4 rounded-xl border border-slate-200 shadow-inner">
                                    {generatedText}
                                </p>
                            ) : (
                                <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-xl">
                                    <Activity className="w-8 h-8 opacity-20" />
                                    <p className="text-[10px] uppercase font-bold tracking-tighter">Henüz seçim yapılmadı</p>
                                </div>
                            )}
                        </ScrollArea>
                        <div className="p-6 bg-white border-t border-slate-200 space-y-3">
                            {selectedIds.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedIds([])}
                                    className="w-full h-8 text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-2 uppercase"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Seçimleri Temizle
                                </Button>
                            )}
                            <Button
                                onClick={handleExport}
                                disabled={!generatedText}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-lg shadow-blue-200 disabled:shadow-none gap-2 uppercase tracking-wide"
                            >
                                <Send className="w-4 h-4" /> Programa Aktar
                            </Button>
                        </div>
                    </aside>
                </div>
            </DialogContent>
        </Dialog>
    );
};
