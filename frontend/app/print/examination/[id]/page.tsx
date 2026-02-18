"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { api, Muayene, Patient } from "@/lib/api";
import { format, parseISO } from "date-fns";
import dynamic from "next/dynamic";
import { ExaminationPDF } from "@/components/pdf/ExaminationPDF";

// Dynamic import for PDFViewer to avoid SSR issues
const PDFViewer = dynamic(() => import("@react-pdf/renderer").then(mod => mod.PDFViewer), {
    ssr: false,
    loading: () => <div className="h-screen flex items-center justify-center text-slate-500">PDF Oluşturuluyor...</div>
});

export default function ExaminationPrintPage() {
    const params = useParams();
    const id = Number(params.id);

    const [exam, setExam] = useState<Muayene | null>(null);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const settingsList = await api.settings.getAll();
                const settingsMap = settingsList.reduce((acc, curr) => {
                    acc[curr.key] = curr.value || "";
                    return acc;
                }, {} as Record<string, string>);
                setSettings(settingsMap);

                const examData = await api.clinical.getMuayene(id);
                setExam(examData);

                if (examData.hasta_id) {
                    const patientData = await api.patients.get(examData.hasta_id);
                    setPatient(patientData);
                }
            } catch (error) {
                console.error("Print data loading failed", error);
            } finally {
                setLoading(false);
            }
        };

        if (id) loadData();
    }, [id]);

    useEffect(() => {
        if (patient && exam) {
            const dateStr = exam.tarih ? format(parseISO(exam.tarih), 'yyyy-MM-dd') : 'Tarihsiz';
            const adSoyad = `${patient.ad}${patient.soyad}`.replace(/\s+/g, '');
            document.title = `${adSoyad}-${dateStr}-Muayene`;
        }
    }, [patient, exam]);

    const sq = useMemo(() => {
        if (!exam || !exam.sistem_sorgu) return {};
        if (exam.sistem_sorgu.startsWith("{")) {
            try { return JSON.parse(exam.sistem_sorgu); } catch { return {}; }
        }
        return {};
    }, [exam]);

    const ipssData = useMemo(() => {
        if (!exam) return null;
        const total = parseInt(exam.ipss_skor || "0");

        // Individual scores from exam fields
        const residivHissi = parseInt(exam.residiv_hissi || "0");
        const kesikIdrar = parseInt(exam.kesik_idrar_yapma || "0");
        const projeksiyon = parseInt(exam.projeksiyon_azalma || "0");
        const baslamaZorluk = parseInt(exam.idrar_bas_zorluk || "0");
        const pollakiuri = parseInt(exam.pollakiuri || "0");
        const urgency = parseInt((exam as any).urgency || "0") || parseInt(sq.urgency || "0");
        const nokturi = parseInt(exam.nokturi || "0");

        // Check if any score exists
        if (total === 0 && residivHissi === 0 && pollakiuri === 0 && nokturi === 0 &&
            kesikIdrar === 0 && projeksiyon === 0 && baslamaZorluk === 0 && urgency === 0) {
            return null;
        }

        const obstructive = residivHissi + kesikIdrar + projeksiyon + baslamaZorluk;
        const irritative = pollakiuri + urgency + nokturi;

        // Build inline text in user's requested format
        // Example: "Rezidü hissi 4, pollakuri 2, nokturi 3, kesik işeme 2, urgency 2, ıkınma 3, projeksiyon 4  IRR: n, OBST: n, IPSS: n"
        const details: string[] = [];
        if (residivHissi > 0) details.push(`Rezidü hissi ${residivHissi}`);
        if (pollakiuri > 0) details.push(`pollakuri ${pollakiuri}`);
        if (nokturi > 0) details.push(`nokturi ${nokturi}`);
        if (kesikIdrar > 0) details.push(`kesik işeme ${kesikIdrar}`);
        if (urgency > 0) details.push(`urgency ${urgency}`);
        if (baslamaZorluk > 0) details.push(`ıkınma ${baslamaZorluk}`);
        if (projeksiyon > 0) details.push(`projeksiyon ${projeksiyon}`);

        // Append scores at the end
        const scoresSuffix = `IRR: ${irritative}, OBST: ${obstructive}, IPSS: ${total}`;
        const detailText = details.length > 0
            ? `${details.join(", ")}  ${scoresSuffix}`
            : scoresSuffix;

        return {
            total,
            obstructive,
            irritative,
            detailText,
            individual: { residivHissi, kesikIdrar, projeksiyon, baslamaZorluk, pollakiuri, urgency, nokturi }
        };
    }, [exam, sq]);

    const iiefData = useMemo(() => {
        if (!exam) return null;
        const score = parseInt((exam as any).iief_ef_skor || "0");
        if (score === 0) return null;

        let severity = "ED Yok";
        let color = "emerald";
        if (score <= 10) { severity = "Şiddetli ED"; color = "red"; }
        else if (score <= 16) { severity = "Orta ED"; color = "orange"; }
        else if (score <= 21) { severity = "Hafif-Orta ED"; color = "yellow"; }
        else if (score <= 25) { severity = "Hafif ED"; color = "lime"; }

        return { score, severity, color };
    }, [exam]);

    const systemInquiry = useMemo(() => {
        if (!exam) return "";
        const parts: string[] = [];
        const mapping: Record<string, string> = {
            disuri: "Disüri",
            hematuri: "Hematüri",
            pollakiuri: "Pollaküri",
            nokturi: "Noktüri",
            urgency: "Sıkışma",
            catallanma: "Çatallanma",
            projeksiyon_azalma: "Zayıf Akım",
            idrar_bas_zorluk: "Başlama Zorluğu",
            kalibre_incelme: "Kalibre İncelme",
            terminal_damlama: "Terminal Damlama",
            kesik_idrar_yapma: "Kesik Kesik Yapma",
            residiv_hissi: "Tam Boşalamama",
            inkontinans: "İnkontinans",
            genital_akinti: "Genital Akıntı",
            kabizlik: "Kabızlık",
            tas_oyku: "Taş Öyküsü",
            ates: "Ateş",
        };

        Object.entries(mapping).forEach(([key, label]) => {
            let val = (exam as any)[key];
            if (!val || val === "Seçiniz..." || val === "0") {
                val = sq[key] || sq[key + "Text"] || sq[key + "SQ"];
            }
            if (val && val !== "Seçiniz..." && val !== "Hayır" && val !== "0" && val !== "Yok") {
                const displayVal = val === "Var" ? "var" : val === "Evet" ? "var" : val.toString().toLowerCase();
                parts.push(`${label} ${displayVal}`);
            }
        });

        return parts.join(", ");
    }, [exam, sq]);

    if (loading) return <div className="p-10 font-sans text-sm text-slate-500 animate-pulse">Yükleniyor...</div>;
    if (!exam || !patient) return <div className="p-10 font-sans text-sm text-red-500">Kayıt bulunamadı.</div>;

    const computedData = {
        sq,
        ipssData,
        iiefData,
        systemInquiry
    };

    return (
        <div className="bg-slate-100 min-h-screen flex flex-col">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xs">M</div>
                    <div className="font-bold text-slate-700">Muayene Raporu Yazdır</div>
                </div>
                <button
                    onClick={() => window.close()}
                    className="bg-rose-600 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-rose-700 transition"
                >
                    KAPAT
                </button>
            </div>

            <div className="flex-1 w-full h-full relative">
                <PDFViewer style={{ width: '100%', height: 'calc(100vh - 70px)', border: 'none' }} showToolbar={true}>
                    <ExaminationPDF exam={exam} patient={patient} settings={settings} computedData={computedData} />
                </PDFViewer>
            </div>
        </div>
    );
}
