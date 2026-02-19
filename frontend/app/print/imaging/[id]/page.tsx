"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Imaging, Patient } from "@/lib/api";
import dynamic from "next/dynamic";
import { ImagingPDF } from "@/components/pdf/ImagingPDF";
import { format, parseISO } from "date-fns";

const PDFViewer = dynamic(
    () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
    {
        ssr: false,
        loading: () => <div className="p-10 font-sans text-sm text-slate-500 animate-pulse">PDF Hazırlanıyor...</div>,
    }
);

export default function ImagingPrintPage() {
    const params = useParams();
    const id = Number(params.id);

    const [imaging, setImaging] = useState<Imaging | null>(null);
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

                const data = await api.clinical.getImaging(id);
                setImaging(data);

                if (data.hasta_id) {
                    const patientData = await api.patients.get(data.hasta_id);
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
        if (patient && imaging) {
            const dateStr = imaging.tarih ? format(parseISO(imaging.tarih), 'yyyy-MM-dd') : 'Tarihsiz';
            const adSoyad = `${patient.ad}${patient.soyad}`.replace(/\s+/g, '');
            document.title = `${adSoyad}-${dateStr}-Goruntuleme`;
        }
    }, [patient, imaging]);

    if (loading) return <div className="p-10 font-sans text-sm text-slate-500 animate-pulse text-center">Yükleniyor...</div>;
    if (!imaging || !patient) return <div className="p-10 font-sans text-sm text-red-500 text-center">Kayıt bulunamadı.</div>;

    return (
        <div className="w-full h-screen bg-slate-100 flex flex-col">
            <div className="flex-1 w-full relative">
                <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
                    <ImagingPDF imaging={imaging} patient={patient} settings={settings} />
                </PDFViewer>
            </div>
        </div>
    );
}
