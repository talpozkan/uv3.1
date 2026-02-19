"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api, MedicalReport } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useAIScribeStore } from "@/stores/ai-scribe-store";
import {
    Plus,
    Save,
    Search,
    Trash2,
    Printer,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { PatientHeader } from "@/components/clinical/patient-header";

const TEMPLATES = [
    {
        title: "Intravezikal BCG Uygulama",
        text: `Hastaya mesane tümörü nüks önleyici tedavisi kapsamında, steril şartlarda üretral kateterizasyon uygulandı. Mesane boşaltıldıktan sonra [Doz Miktarı] ünite BCG (Bacillus Calmette-Guérin) solüsyonu intravezikal yolla zerk edildi. İşlem sonrası kateter çekildi. Hastaya ilacı 2 saat mesanesinde tutması ve pozisyon değiştirmesi önerildi.`
    },
    {
        title: "Sonda Takılması (Üretral Kateterizasyon)",
        text: `Hastaya [Endikasyon: Üriner retansiyon vb.] nedeniyle steril koşullarda, uygun boyutta (No: ...) Foley kateter uygulandı. Balon [10 cc] SF ile şişirilerek sabitlendi. Aktif idrar çıkışı gözlendi. İdrar torbası bağlantısı yapıldı.`
    },
    {
        title: "Kriyoterapi",
        text: `Hastanın [Vücut Bölgesi] bölgesinde yer alan lezyonlara, sıvı azot kullanılarak kriyoterapi cihazı ile [Kaç seans/sn] uygulama yapıldı. İşlem sonrası lokal bakım önerileri hastaya sözlü ve yazılı olarak iletildi.`
    },
    {
        title: "Lazer Kondilom Ablasyonu",
        text: `Lokal anestezi altında, anogenital bölgede saptanan tüm kondilomatöz lezyonlar lazer (CO2/Nd:YAG) ile ablate edilerek temizlendi. İşlem sırasında çevre doku korundu, hemostaz sağlandı.`
    },
    {
        title: "Aşı Uygulama",
        text: `Hastaya [Aşı Adı] aşısı, [Uygulama Yolu: IM/Subkutan] ve [Uygulama Bölgesi: örn. Sağ Deltoid] yoluyla uygulandı. Hasta, olası alerjik reaksiyonlara karşı 15 dakika müşahede altında tutuldu.`
    },
    {
        title: "Ürostomi Takılması/Bakımı",
        text: `Ürostomi stoması çevresi temizlendi, stoma sağlığı kontrol edildi. Uygun boyutta adaptör ve ürostomi torbası, sızıntı olmayacak şekilde cilde uygulandı. Torba boşaltma mekanizması kontrol edildi.`
    },
    {
        title: "Basit Cerrahi Müdahale",
        text: `Lokal anestezi (Aritmal %2) altında, [Bölge] bölgesindeki [Lezyon/Yara] eksize edildi/temizlendi. Kanama kontrolü yapıldı. [Sütür Tipi] ile primer sütürize edildi. Steril pansuman ile kapatıldı.`
    },
    {
        title: "Pansuman",
        text: `Mevcut yara/insizyon bölgesi aseptik solüsyonlarla temizlendi. Enfeksiyon bulgusu [Saptanmadı / Saptandı]. Yara kenarları debride edildi ve steril gazlı bez/modern yara bakım ürünleri ile pansuman yenilendi.`
    },
    {
        title: "Perkütan Suprapubik Sistostomi Takılması",
        text: `Hastaya [Endikasyon: Üretral darlık/Akut retansiyon vb.] nedeniyle suprapubik bölge sterilizasyonunu müteakip lokal anestezi uygulandı. Ultrason eşliğinde (veya palpasyonla) mesane lokalize edildi. Suprapubik hattan trokar yardımıyla (veya insizyonla) mesaneye girilerek [No: ...] foley kateter yerleştirildi. Kateter balonu [5-10 cc] SF ile şişirildi ve cilde [Sütür tipi] ile tespit edildi. Aktif idrar çıkışı gözlendi, steril pansuman ile işlem sonlandırıldı.`
    }
];

export default function MedicalReportPage() {
    const params = useParams();
    const patientId = String(params.id);
    const [patient, setPatient] = useState<any>(null);
    const [reports, setReports] = useState<MedicalReport[]>([]);

    // Form State
    const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
    const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 16));
    const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
    const [procedureTitle, setProcedureTitle] = useState("");
    const [procedureDetail, setProcedureDetail] = useState("");
    const [conclusion, setConclusion] = useState("İşlem sorunsuz tamamlanmıştır. Hastaya [İlaç/Reçete] önerilmiş ve [Tarih] tarihinde kontrol randevusu verilmiştir.");

    const loadData = async () => {
        try {
            const [pData, rData] = await Promise.all([
                api.patients.get(patientId),
                api.clinical.getMedicalReports(patientId)
            ]);
            setPatient(pData);
            setReports(rData);

            if (rData.length > 0 && !selectedReportId) {
                handleSelectReport(rData[0]);
            }
        } catch (error) {
            console.error(error);
            toast.error("Veriler yüklenirken hata oluştu.");
        }
    };

    useEffect(() => {
        if (patientId) loadData();
    }, [patientId]);

    const handleNewReport = () => {
        setSelectedReportId(null);
        setReportDate(new Date().toISOString().slice(0, 16));
        setSelectedTemplateIndex(null);
        setProcedureTitle("");
        setProcedureDetail("");
        setConclusion("İşlem sorunsuz tamamlanmıştır. Hastaya [İlaç/Reçete] önerilmiş ve [Tarih] tarihinde kontrol randevusu verilmiştir.");
        toast.info("Yeni tıbbi müdahale raporu formu.");
    };

    const handleSelectReport = (report: MedicalReport) => {
        setSelectedReportId(report.id);
        setReportDate(report.tarih ? new Date(report.tarih).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
        setProcedureTitle(report.islem_basligi || "");
        setProcedureDetail(report.islem_detayi || "");
        setConclusion(report.sonuc_oneriler || "");
        setSelectedTemplateIndex(null); // Custom loaded report
    };

    // --- API: Settings ---
    const { data: settings = [] } = useQuery({
        queryKey: ['settings'],
        queryFn: api.settings.getAll,
    });

    const [templates, setTemplates] = useState<{ title: string, text: string }[]>(TEMPLATES);

    useEffect(() => {
        if (settings.length > 0) {
            const defs = settings.find((s: typeof settings[0]) => s.key === 'system_definitions')?.value;
            if (defs) {
                try {
                    const parsed = JSON.parse(defs);
                    const customTemplates = parsed['Tıbbi Müdahale Şablonları'];
                    if (customTemplates && Array.isArray(customTemplates) && customTemplates.length > 0) {
                        setTemplates(customTemplates.map((t: string) => {
                            const parts = t.split('|');
                            return {
                                title: parts[0] || "Başlıksız",
                                text: parts[1] || ""
                            };
                        }));
                    }
                } catch (e) {
                    console.error("Error parsing templates", e);
                }
            }
        }
    }, [settings]);

    const handleTemplateSelect = (index: number) => {
        setSelectedTemplateIndex(index);
        setProcedureTitle(templates[index].title);
        setProcedureDetail(templates[index].text);
    };

    const handleSave = async () => {
        try {
            const payload = {
                hasta_id: patientId,
                tarih: reportDate,
                islem_basligi: procedureTitle,
                islem_detayi: procedureDetail,
                sonuc_oneriler: conclusion
            };

            if (selectedReportId) {
                await api.clinical.updateMedicalReport(selectedReportId, payload);
                toast.success("Rapor güncellendi.");
            } else {
                const newReport = await api.clinical.createMedicalReport(payload);
                toast.success("Rapor oluşturuldu.");
                setSelectedReportId(newReport.id);
            }
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Kaydetme başarısız.");
        }
    };

    const handleDelete = async () => {
        if (!selectedReportId) return;
        try {
            await api.clinical.deleteMedicalReport(selectedReportId);
            toast.success("Rapor silindi.");
            handleNewReport();
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Silme başarısız.");
        }
    };

    const handlePrint = () => {
        if (selectedReportId) {
            window.open(`/print/medical-report/${selectedReportId}`, '_blank');
        } else {
            toast.error("Yazdırmak için önce raporu kaydedin.");
        }
    };

    // Keyboard Shortcuts
    useKeyboardShortcuts({
        onSave: handleSave,
        onSearch: () => {
            const searchInput = document.querySelector('input[placeholder="Raporlarda ara..."]') as HTMLInputElement;
            if (searchInput) {
                searchInput.focus();
                toast.info("Arama kutusuna odaklandı.");
            }
        }
    });

    // AI Scribe Integration
    const { latestResult, setLatestResult } = useAIScribeStore();

    useEffect(() => {
        if (latestResult) {
            // Apply AI clinical note to procedure detail field
            if (latestResult.clinical_note) {
                setProcedureDetail(prev => {
                    const newDetail = prev ? prev + "\n\n" + latestResult.clinical_note : latestResult.clinical_note;
                    return newDetail || "";
                });
                toast.success("AI analizi rapor detayına eklendi.");
                setLatestResult(null);
            }
        }
    }, [latestResult, setLatestResult]);

    return (
        <div className="flex h-full flex-col gap-6 p-6 lg:flex-row bg-slate-50/50 min-h-screen">
            {/* Main Content */}
            <div className="flex-1 space-y-6">
                <PatientHeader patient={patient} moduleName="Tıbbi Müdahale Raporu" />

                {/* Action Bar */}
                <div className="rounded-xl border border-white bg-white shadow-sm p-2 flex items-center justify-end gap-2">
                    <div className="flex items-center gap-2">
                        <Button
                            className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 uppercase text-xs tracking-wide shadow-sm"
                            onClick={handleNewReport}
                        >
                            <Plus className="h-3 w-3" />
                            YENİ RAPOR
                        </Button>
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                        <Button
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 uppercase text-xs tracking-wide shadow-sm"
                            onClick={handleSave}
                        >
                            <Save className="h-3 w-3" />
                            KAYDET
                        </Button>
                        {selectedReportId && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button className="h-8 bg-red-600 hover:bg-red-700 text-white font-bold gap-2 uppercase text-xs tracking-wide shadow-sm">
                                        <Trash2 className="h-3 w-3" />
                                        SİL
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Raporu silmek istediğinize emin misiniz?</AlertDialogTitle>
                                        <AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Sil</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                        onClick={handlePrint}
                        disabled={!selectedReportId}
                        title="Yazdır"
                    >
                        <Printer className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex gap-6">
                    {/* Templates Sidebar */}
                    <div className="w-[300px] shrink-0 space-y-4">
                        <div className="bg-white rounded-xl border border-white shadow-sm p-4 h-full">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">HAZIR ŞABLONLAR</h3>
                            <ScrollArea className="h-[600px]">
                                <div className="space-y-2 pr-2">
                                    {templates.map((template, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleTemplateSelect(index)}
                                            className={cn(
                                                "w-full text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 p-3 rounded-lg text-xs font-semibold text-slate-700 transition-all",
                                                selectedTemplateIndex === index && "bg-blue-100 border-blue-500 text-blue-900 ring-1 ring-blue-500"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-black shrink-0">
                                                    {index + 1}
                                                </span>
                                                <span className="leading-tight">{template.title}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="flex-1 rounded-xl border border-white bg-white shadow-sm p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">İşlem Tarihi / Saati</Label>
                                <Input type="datetime-local" value={reportDate} onChange={e => setReportDate(e.target.value)} className="font-bold w-full" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Seçilen İşlem Başlığı</Label>
                                <Input
                                    value={procedureTitle}
                                    onChange={e => setProcedureTitle(e.target.value)}
                                    placeholder="Bir şablon seçin veya başlık girin"
                                    className="font-bold w-full bg-slate-50"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">İŞLEM DETAYI VE UYGULAMA METNİ</Label>
                            <Textarea
                                placeholder="İşlem detaylarını buraya girin veya soldan bir şablon seçin..."
                                value={procedureDetail}
                                onChange={e => setProcedureDetail(e.target.value)}
                                className="min-h-[200px] font-medium leading-relaxed font-mono text-sm"
                            />
                            <p className="text-[10px] text-slate-400 italic text-right">Köşeli parantez içindeki [...] alanları doldurunuz.</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">SONUÇ VE ÖNERİLER</Label>
                            <Textarea
                                placeholder="Sonuç ve öneriler..."
                                value={conclusion}
                                onChange={e => setConclusion(e.target.value)}
                                className="min-h-[100px] font-medium"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar List */}
            <div className="w-full lg:w-[340px] space-y-4 shrink-0">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Raporlarda ara..." className="pl-9 bg-slate-50 border-slate-200" />
                    </div>
                </div>
                <div className="rounded-xl border border-white bg-white shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)] sticky top-6">
                    <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">GEÇMİŞ RAPORLAR</h3>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{reports.length}</span>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="flex flex-col">
                            {reports.map((report) => (
                                <button
                                    key={report.id}
                                    onClick={() => handleSelectReport(report)}
                                    className={cn(
                                        "flex flex-col gap-1 p-3 text-left transition-colors border-b border-slate-50 hover:bg-slate-50",
                                        selectedReportId === report.id ? "bg-blue-50/50 border-l-4 border-l-blue-500" : "border-l-4 border-l-transparent"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-700">
                                            {report.tarih ? format(new Date(report.tarih), 'dd.MM.yyyy') : '-'}
                                        </span>
                                        <span className="text-[10px] text-slate-400">#{report.id}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 line-clamp-1 font-bold">
                                        {report.islem_basligi || "Başlıksız İşlem"}
                                    </div>
                                </button>
                            ))}
                            {reports.length === 0 && (
                                <div className="p-8 text-center text-slate-400 text-xs text-opacity-70">
                                    Henüz rapor kaydı yok.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}
