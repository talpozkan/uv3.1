'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, CheckCircle2, XCircle, Link2, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export function IntegrationsSettings() {
    const queryClient = useQueryClient();
    const [isConnecting, setIsConnecting] = useState(false);

    // Get Google Sync Status
    const { data: status, isLoading: isLoadingStatus } = useQuery({
        queryKey: ['integrations', 'google', 'status'],
        queryFn: api.integrations.getGoogleStatus,
    });

    const handleConnectGoogle = async () => {
        try {
            setIsConnecting(true);
            const { url } = await api.integrations.getGoogleAuthUrl();
            // Redirect to Google OAuth
            window.location.href = url;
        } catch (error: any) {
            toast.error("Google bağlantı URL'i alınamadı: " + error.message);
            setIsConnecting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Google Calendar Card */}
            <Card className="border-white shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            Google Calendar Entegrasyonu
                        </CardTitle>
                        {status?.connected ? (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Bağlı
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-slate-400 flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Bağlı Değil
                            </Badge>
                        )}
                    </div>
                    <CardDescription>
                        Randevularınızı otomatik olarak kişisel Google takviminizle senkronize edin.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingStatus ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    ) : status?.connected ? (
                        <div className="space-y-4">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                                <p className="text-xs text-slate-500">Bağlantı Durumu</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">Google Hesabı Aktif</span>
                                    {status.expiry && (
                                        <span className="text-[10px] text-slate-400">
                                            Geçerlilik: {format(new Date(status.expiry), 'dd MMMM HH:mm', { locale: tr })}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={handleConnectGoogle}
                                    disabled={isConnecting}
                                >
                                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                                    Yeniden Bağla
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-sm text-slate-600 leading-relaxed">
                                Google Calendar bağlantısı kurduğunuzda, UroLog üzerinden oluşturduğunuz randevular anında takviminize işlenir.
                            </div>
                            <Button
                                className="w-full bg-[#4285F4] hover:bg-[#357abd] text-white"
                                onClick={handleConnectGoogle}
                                disabled={isConnecting}
                            >
                                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                                Google ile Bağlan
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* iCal / .ics Card */}
            <Card className="border-white shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Download className="h-4 w-4 text-purple-500" />
                        iCal (.ics) Desteği
                    </CardTitle>
                    <CardDescription>
                        Randevularınızı manuel olarak Apple Calendar, Outlook veya mobil takviminize aktarın.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-sm text-slate-600 leading-relaxed">
                        iCal desteği pasif bir entegrasyondur. Randevu detay sayfasındaki "iCal İndir" butonuna basarak randevuyu takviminize manuel ekleyebilirsiniz.
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 italic text-[11px] text-purple-700">
                        * Bu özellik herhangi bir hesap bağlantısı gerektirmez ve tüm randevular için varsayılan olarak aktiftir.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
