"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Printer, ChevronLeft, Download } from "lucide-react";
import { api, Patient } from "@/lib/api";
import { Button } from "@/components/ui/button";

const recommendations = {
    diyet: {
        title: "Diyet Önerileri",
        content: [
            "Günlük tuz tüketimini kısıtlayın (maksimum 5g/gün).",
            "Hazır gıdalardan ve işlenmiş etlerden uzak durun.",
            "Günde en az 2-2.5 litre su tüketin.",
            "Lifli gıdalar (sebze, meyve, tam tahıllar) öncelikli olmalıdır.",
            "Kırmızı et tüketimini haftada 2 gün ile sınırlayın.",
            "Akşam saat 20:00'den sonra ağır gıdalar tüketmeyin."
        ],
        footer: "Bu liste genel öneriler içermektedir. Kişiselleştirilmiş diyet programı için diyetisyene danışınız."
    },
    egzersiz: {
        title: "Egzersiz ve Yaşam Tarzı Önerileri",
        content: [
            "Haftada en az 150 dakika orta şiddetli aerobik egzersiz (hızlı yürüyüş vb.) yapın.",
            "Haftada 2-3 gün kas güçlendirici egzersizler ekleyin.",
            "Gün içinde uzun süre oturmaktan kaçının, her saat başı 5 dakika hareket edin.",
            "Pelvik taban egzersizlerini (Kegel) düzenli yapın.",
            "İdeal kilonuzu korumaya özen gösterin.",
            "Stres yönetimi için nefes egzersizleri veya yoga yapabilirsiniz."
        ],
        footer: "Egzersiz programına başlamadan önce doktorunuza danışınız."
    },
    aam: {
        title: "Aktif Alan İzlemi (AAM) Bilgilendirme",
        content: [
            "Düzenli kontrollerinizi aksatmayın (PSA, muayene vb.).",
            "İdrar yapma alışkanlıklarınızdaki değişiklikleri not edin.",
            "Ani başlayan kemik ağrısı veya halsizlik durumunda doktorunuza bildirin.",
            "Sağlıklı beslenme ve düzenli egzersiz programına uyun.",
            "Sigara ve alkol tüketiminden kaçının.",
            "Doktorunuzun belirlediği periyotlarda görüntüleme (Emar vb.) yaptırın."
        ],
        footer: "Aktif izlem sürecinde yakın takip hayati önem taşımaktadır."
    },
    hpv: {
        title: "HPV Korunma ve Takip Önerileri",
        content: [
            "Bağışıklık sisteminizi güçlü tutun (uyku, beslenme, stres yönetimi).",
            "Sigara kullanımını tamamen bırakın (virüsün temizlenmesini zorlaştırır).",
            "Cinsel partnerinizle durumu paylaşın ve korunma yöntemlerini kullanın.",
            "Doktorunuzun önerdiği periyotlarda kontrollerinizi ve smear/HPV testlerinizi yaptırın.",
            "Siğil veya lezyon fark ettiğinizde hemen doktorunuza başvurun.",
            "Gerekli durumlarda aşılanma seçeneklerini doktorunuzla görüşün."
        ],
        footer: "HPV yönetimi uzun süreli takip gerektiren bir süreçtir."
    }
};

export default function RecommendationPrintPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [settings, setSettings] = useState<Record<string, string>>({});
    const type = params.type as string;
    const patientId = searchParams.get("patientId");

    const data = recommendations[type as keyof typeof recommendations];

    useEffect(() => {
        if (patientId) {
            api.patients.getById(parseInt(patientId)).then(setPatient).catch(console.error);
        }
        api.settings.getAll().then(list => {
            const map = list.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});
            setSettings(map);
        }).catch(console.error);
    }, [patientId]);

    const handlePrint = () => {
        window.print();
    };

    if (!data) return <div className="p-10">Öneri bulunamadı.</div>;

    return (
        <div className="min-h-screen bg-slate-50 print:bg-white p-4 sm:p-8 font-sans">
            {/* Header Controls (Hidden on Print) */}
            <div className="max-w-3xl mx-auto mb-8 flex items-center justify-between print:hidden">
                <Button variant="outline" onClick={() => window.close()} className="gap-2">
                    <ChevronLeft className="w-4 h-4" /> Kapat
                </Button>
                <div className="flex gap-2">
                    <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Printer className="w-4 h-4" /> Yazdır
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none border border-slate-200 print:border-none p-[15mm] min-h-[297mm] flex flex-col">

                {/* Clinic Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                            {settings.clinic_name || "ÜROLOJİ KLİNİĞİ"}
                        </h1>
                        <p className="text-sm text-slate-600 font-medium">
                            {settings.doctor_name || "Dr. Alp Özkan"}
                        </p>
                    </div>
                    <div className="text-right text-[10px] text-slate-500 font-mono">
                        <p>{format(new Date(), "dd.MM.yyyy HH:mm", { locale: tr })}</p>
                    </div>
                </div>

                {/* Patient Info Card */}
                {patient && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8 flex justify-between items-center text-sm">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hasta Adı Soyadı</span>
                            <span className="font-bold text-slate-800">{patient.ad} {patient.soyad}</span>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protokol No</span>
                            <span className="font-mono text-blue-600 font-bold">{patient.protokol_no}</span>
                        </div>
                    </div>
                )}

                {/* Recommendation Title */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-blue-700 border-l-4 border-blue-700 pl-4 mb-2">
                        {data.title}
                    </h2>
                    <div className="h-0.5 w-full bg-slate-100 mt-4" />
                </div>

                {/* Main Content */}
                <div className="flex-1">
                    <ul className="space-y-4">
                        {data.content.map((item, idx) => (
                            <li key={idx} className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                                    {idx + 1}
                                </span>
                                <span className="text-slate-700 text-base leading-relaxed">
                                    {item}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer / Notes */}
                <div className="mt-12 pt-8 border-t border-slate-100">
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-xs text-amber-800 italic leading-relaxed">
                        {data.footer}
                    </div>
                    <div className="mt-8 flex justify-between items-end">
                        <div className="text-[9px] text-slate-400 font-mono uppercase tracking-widest leading-loose">
                            Bu belge dijital olarak oluşturulmuştur.<br />
                            Tarih: {format(new Date(), "dd.MM.yyyy", { locale: tr })}
                        </div>
                        <div className="text-center w-48 border-t border-slate-200 pt-4">
                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Doktor İmzası</p>
                            <p className="text-xs font-bold text-slate-800">{settings.doctor_name || "Dr. Alp Özkan"}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
