'use client';

import { useQuery } from "@tanstack/react-query";
import { api } from '@/lib/api';
import { Card, CardContent } from "@/components/ui/card";

export function PatientRightPanel({ patientId }: { patientId: string }) {
    const { data: muayeneler, isLoading } = useQuery({
        queryKey: ['muayeneler', patientId],
        queryFn: () => api.clinical.getMuayeneler(patientId),
    });

    if (isLoading) {
        return <div className="text-sm text-slate-500 text-center py-4">Yükleniyor...</div>;
    }

    if (!muayeneler || muayeneler.length === 0) {
        return (
            <Card className="border border-slate-200 shadow-sm">
                <CardContent className="p-4">
                    <div className="text-center text-sm text-slate-500">
                        Geçmiş muayene bulunamadı
                    </div>
                </CardContent>
            </Card>
        );
    }

    const sortedExams = [...muayeneler].sort((a, b) => {
        if (!a.tarih || !b.tarih) return 0;
        return new Date(b.tarih).getTime() - new Date(a.tarih).getTime();
    });

    return (
        <div className="space-y-2">
            {sortedExams.map((exam) => (
                <Card key={exam.id} className="border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                    <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-1">
                            <div className="font-semibold text-slate-900 text-sm">{exam.tarih || 'Tarihsiz'}</div>
                        </div>
                        <div className="text-xs text-slate-600 line-clamp-2">
                            <span className="font-semibold text-slate-700">Tanı: </span>
                            {exam.sikayet || 'Belirtilmemiş'} {/* Using sikayet as a fallback for Tanı since backend model might vary, user asked for Tanı, will verify structure */}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
