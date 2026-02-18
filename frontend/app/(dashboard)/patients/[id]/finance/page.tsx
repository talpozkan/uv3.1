"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, FinansIslemCreate, FinansIslem } from "@/lib/api";
import { PatientHeader } from "@/components/clinical/patient-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Wallet, ArrowUpRight, ArrowDownLeft, Loader2, Printer, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/stores/auth-store";

export default function FinancePage() {
    const params = useParams();
    const patientId = String(params.id);
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("hizmet"); // hizmet | tahsilat

    const [editId, setEditId] = useState<number | null>(null);

    // --- Queries ---
    const { data: patient } = useQuery({
        queryKey: ['patient', patientId],
        queryFn: () => api.patients.get(patientId),
    });

    const { data: hareketler = [], isLoading } = useQuery({
        queryKey: ['finance_transactions', patientId],
        queryFn: () => api.finance.getPatientTransactions(patientId),
    });

    const { data: hizmetler = [] } = useQuery({
        queryKey: ['hizmetler'],
        queryFn: () => api.finance.getServices(true)
    });

    const { data: muayeneler = [] } = useQuery({
        queryKey: ['muayeneler', patientId],
        queryFn: () => api.clinical.getMuayeneler(patientId)
    });


    const { data: kasalar = [] } = useQuery({
        queryKey: ['kasalar'],
        queryFn: () => api.finance.getAccounts(true)  // Use new accounts endpoint
    });

    // --- Mutations ---
    const createMutation = useMutation({
        mutationFn: api.finance.createTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['finance_transactions', patientId] });
            toast.success("İşlem başarıyla kaydedildi.");
            setTransactionDialogOpen(false);
            resetForm();
        },
        onError: (err: any) => {
            toast.error("İşlem kaydedilemedi: " + (err.message || ''));
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<FinansIslemCreate> }) => api.finance.updateTransaction(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['finance_transactions', patientId] });
            toast.success("İşlem başarıyla güncellendi.");
            setTransactionDialogOpen(false);
            resetForm();
        },
        onError: () => toast.error("Güncelleme başarısız.")
    });

    const deleteMutation = useMutation({
        mutationFn: api.finance.deleteTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['finance_transactions', patientId] });
            toast.success("Kayıt silindi.");
        },
        onError: () => toast.error("Silme işlemi başarısız.")
    });

    // --- Form State ---
    // Modified to match FinansIslemCreate structure roughly flattened for form
    const [formData, setFormData] = useState<any>({
        tarih: new Date().toISOString().split('T')[0],
        para_birimi: 'TRY',
        doktor: user?.full_name || ""
    });

    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

    const resetForm = () => {
        setFormData({
            tarih: new Date().toISOString().split('T')[0],
            para_birimi: 'TRY',
            doktor: user?.full_name || ""
        });
        setSelectedServiceId(null);
        setEditId(null);
        setActiveTab("hizmet");
    };

    const handleEdit = (item: FinansIslem) => {
        setEditId(item.id);

        // Determine if it's a SERVICE (has satirlar) or COLLECTION (has odemeler but no satirlar/amount)
        // Usually:
        // Hizmet: satirlar.length > 0
        // Tahsilat: satirlar.length === 0 && odemeler.length > 0 (or just islem_tipi === 'gelir' and no lines) (Actually Tahsilat is also 'gelir' type in our mapping)

        // Correction: 
        // We map "Hizmet" -> FinansIslem (tutar > 0, satirlar > 0)
        // We map "Tahsilat" -> FinansIslem (tutar = 0, odemeler > 0)

        const isHizmet = (item.satirlar && item.satirlar.length > 0) || (!item.odemeler || item.odemeler.length === 0);

        setActiveTab(isHizmet ? 'hizmet' : 'tahsilat');

        // Extract data
        const satir = item.satirlar?.[0];
        const odeme = item.odemeler?.[0];

        setFormData({
            tarih: item.tarih ? item.tarih.split('T')[0] : new Date().toISOString().split('T')[0],
            doktor: item.doktor || user?.full_name || "",
            aciklama: item.aciklama,

            // Hizmet Specific
            borc: item.net_tutar, // This is the total amount
            hizmet_id: satir?.hizmet_id,
            muayene_id: item.muayene_id,

            // Tahsilat Specific
            alacak: odeme?.tutar || 0,
            kasa_id: odeme?.kasa_id,
            odeme_yontemi: odeme?.odeme_yontemi,
            odeme_araci: 'Nakit', // Default or from somewhere if added
        });

        if (satir?.hizmet_id) {
            setSelectedServiceId(String(satir.hizmet_id));
        }

        setTransactionDialogOpen(true);
    };

    const handleHizmetSelect = (hizmetId: string) => {
        const hizmet = hizmetler.find(h => h.id === Number(hizmetId));
        setSelectedServiceId(hizmetId);
        if (hizmet) {
            setFormData((prev: any) => ({
                ...prev,
                hizmet_id: hizmet.id,
                borc: Number(hizmet.varsayilan_fiyat || 0),
                aciklama: hizmet.ad,
            }));
        }
    };

    const handleSubmit = () => {
        // Construct FinansIslemCreate
        const isHizmet = activeTab === 'hizmet';
        const isTahsilat = activeTab === 'tahsilat';

        let payload: FinansIslemCreate = {
            hasta_id: patientId,
            tarih: formData.tarih,
            islem_tipi: 'gelir', // Default to Gelir for both debt creation (service) and payment (in current logic)
            // Wait, if we create a Service (Debt), it is 'gelir' (Income for clinic)
            // If we create a Payment (Collection), we attach it to a transaction.

            // Strategy:
            // Hizmet: FinansIslem (tutar=X, satirlar=[...]) 
            // Tahsilat: FinansIslem (tutar=0, odemeler=[...])  -> This acts as pure payment

            tutar: isHizmet ? Number(formData.borc || 0) : 0,
            para_birimi: formData.para_birimi,
            net_tutar: isHizmet ? Number(formData.borc || 0) : 0, // Assuming no tax calc for now

            doktor: formData.doktor,
            aciklama: formData.aciklama,
            muayene_id: isHizmet ? formData.muayene_id : undefined,

            satirlar: [],
            odemeler: []
        };

        if (isHizmet) {
            if (!payload.net_tutar) {
                toast.error("Tutar girmelisiniz.");
                return;
            }
            // Add Line
            const selectedService = hizmetler.find(h => h.id === formData.hizmet_id);
            payload.satirlar = [{
                hizmet_id: formData.hizmet_id,
                hizmet_adi: selectedService?.ad || formData.aciklama || 'Hizmet',
                adet: 1,
                birim_fiyat: payload.net_tutar,
                toplam: payload.net_tutar,
                doktor: formData.doktor
            }];
        }

        if (isTahsilat) {
            const amount = Number(formData.alacak || 0);
            if (!amount) {
                toast.error("Tutar girmelisiniz.");
                return;
            }
            if (!formData.kasa_id) {
                toast.error("Kasa/Hesap seçmelisiniz.");
                return;
            }

            // Add Payment
            payload.odemeler = [{
                kasa_id: formData.kasa_id,
                odeme_tarihi: formData.tarih,
                tutar: amount,
                odeme_yontemi: formData.odeme_yontemi || 'Nakit',
                taksit_sayisi: 1,
                kapora: false,
                notlar: formData.aciklama
            }];

            // Also set 'kasa_id' on main transaction for reference if single payment
            payload.kasa_id = formData.kasa_id;
        }

        if (editId) {
            updateMutation.mutate({ id: editId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    // --- Calculations ---
    const summary = useMemo(() => {
        let totalBorc = 0;
        let totalAlacak = 0;
        // Calculate totals
        if (hareketler) {
            hareketler.forEach((h: FinansIslem) => {
                // Borç = Net Tutar (Services)
                totalBorc += Number(h.net_tutar || 0);

                // Alacak = Sum of Payments
                const paid = h.odemeler?.reduce((acc, curr) => acc + (curr.tutar || 0), 0) || 0;
                totalAlacak += paid;
            });
        }
        return {
            totalBorc,
            totalAlacak,
            bakiye: totalBorc - totalAlacak
        };
    }, [hareketler]);

    // Compute running balance for table
    // Sort Date ASC first to compute balance
    const sortedHareketler = useMemo(() => {
        if (!hareketler) return [];
        const sorted = [...hareketler].sort((a: FinansIslem, b: FinansIslem) => {
            const dateA = new Date(a.tarih || '').getTime();
            const dateB = new Date(b.tarih || '').getTime();
            // If dates equal, ID order (assuming ID increments)
            if (dateA === dateB) return (a.id || 0) - (b.id || 0);
            return dateA - dateB;
        });

        let runningBalance = 0;
        const withBalance = sorted.map((h: FinansIslem) => {
            const debt = Number(h.net_tutar || 0);
            const paid = h.odemeler?.reduce((acc, curr) => acc + (curr.tutar || 0), 0) || 0;

            runningBalance += debt;
            runningBalance -= paid;
            return { ...h, bakiye: runningBalance, paid_amount: paid };
        });

        // Now reverse for display (Newest first)
        return withBalance.reverse();
    }, [hareketler]);

    // Helpers
    const getKasaName = (id?: number) => kasalar.find(k => k.id === id)?.ad || '-';
    const getHizmetName = (id?: number) => hizmetler.find(h => h.id === id)?.ad || '-';

    // Currency symbol helper
    const getCurrencySymbol = (currency?: string) => {
        switch (currency?.toUpperCase()) {
            case 'USD': case '$': return '$';
            case 'EUR': case '€': return '€';
            case 'GBP': case '£': return '£';
            default: return '₺'; // TL default
        }
    };

    const handlePrint = (item: any) => {
        const printData = {
            patient: patient,
            transaction: {
                ...item,
                hizmet_ad: item.satirlar?.[0]?.hizmet_adi || 'Hizmet'
            },
            doctor: item.doktor
        };
        localStorage.setItem("print_receipt_draft", JSON.stringify(printData));
        window.open("/print/receipt", "_blank", "width=800,height=900");
    };

    // --- Delete Dialog ---

    const [deleteId, setDeleteId] = useState<number | null>(null);

    return (
        <div className="flex h-full flex-col bg-slate-50/50 min-h-screen" >
            <div className="flex-1 flex flex-col min-w-0 p-6 gap-6">

                <PatientHeader patient={patient ?? null} moduleName="Finansal Kayıtlar" moduleSubtitle="Cari hesap ve ödeme takibi" />

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowUpRight className="h-10 w-10 text-slate-600" /></div>
                        <CardHeader className="pb-1">
                            <CardTitle className="text-[10px] font-bold text-slate-500 uppercase">Toplam Hizmet</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold text-slate-700">
                                {summary.totalBorc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border-emerald-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowDownLeft className="h-10 w-10 text-emerald-600" /></div>
                        <CardHeader className="pb-1">
                            <CardTitle className="text-[10px] font-bold text-slate-500 uppercase">Toplam Tahsilat</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold text-emerald-600">
                                {summary.totalAlacak.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={cn("shadow-sm relative overflow-hidden", summary.bakiye > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200")}>
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="h-10 w-10 text-slate-900" /></div>
                        <CardHeader className="pb-1">
                            <CardTitle className="text-[10px] font-bold text-slate-500 uppercase">Genel Bakiye</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-xl font-bold", summary.bakiye > 0 ? "text-red-700" : "text-emerald-700")}>
                                {Math.abs(summary.bakiye).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </div>
                            <p className="text-[9px] font-medium opacity-70 mt-0.5">{summary.bakiye > 0 ? "Bekleyen toplam borç" : "Fazla ödeme / Avans"}</p>
                        </CardContent>
                    </Card>

                    {/* Hızlı Özet Bilgi */}
                    <div className="flex flex-col justify-center bg-slate-900 p-4 rounded-xl text-white shadow-lg border border-slate-800">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Durum Bilgisi</span>
                        <div className="flex items-baseline gap-2">
                            <div className="text-lg font-black">{summary.bakiye > 0 ? "KALAN BORÇ" : "ÖDEME TAMAM"}</div>
                            <div className="text-xs text-slate-400 font-mono">#{summary.totalBorc > 0 ? ((summary.totalAlacak / summary.totalBorc) * 100).toFixed(0) : 0}%</div>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full transition-all duration-1000"
                                style={{ width: `${Math.min(100, (summary.totalAlacak / (summary.totalBorc || 1)) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions & List */}
                <div className="flex justify-end">
                    <Dialog open={transactionDialogOpen} onOpenChange={(open) => {
                        setTransactionDialogOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button className="bg-slate-900 text-white hover:bg-black">
                                <Plus className="h-4 w-4 mr-2" /> Yeni İşlem / Ödeme
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] w-full min-w-[1000px]">
                            <DialogHeader>
                                <DialogTitle>{editId ? "İşlem Düzenle" : "Finansal İşlem Ekle"}</DialogTitle>
                            </DialogHeader>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="hizmet">Hizmet / Borç Ekle</TabsTrigger>
                                    <TabsTrigger value="tahsilat">Tahsilat / Ödeme Al</TabsTrigger>
                                </TabsList>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Tarih</Label>
                                            <Input
                                                type="date"
                                                value={formData.tarih}
                                                onChange={(e) => setFormData({ ...formData, tarih: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>İlgili Doktor</Label>
                                            <Input
                                                value={formData.doktor}
                                                onChange={(e) => setFormData({ ...formData, doktor: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label>Para Birimi</Label>
                                            <Select
                                                value={formData.para_birimi}
                                                onValueChange={(val) => setFormData({ ...formData, para_birimi: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="TRY">Türk Lirası (₺)</SelectItem>
                                                    <SelectItem value="USD">Amerikan Doları ($)</SelectItem>
                                                    <SelectItem value="EUR">Euro (€)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <TabsContent value="hizmet" className="space-y-4 mt-0">
                                        {/* İlişkili Muayene Seçimi */}
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase">İlişkili Muayene</Label>
                                            <Select
                                                value={formData.muayene_id?.toString()}
                                                onValueChange={(val) => setFormData((prev: any) => ({ ...prev, muayene_id: Number(val) }))}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-xs">
                                                    <SelectValue placeholder="Muayene seçilmedi" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">Seçilmedi</SelectItem>
                                                    {muayeneler.slice(0, 5).map(m => {
                                                        const mDate = m.tarih ? format(parseISO(m.tarih), "dd.MM.yyyy") : "Tarihsiz";
                                                        return (
                                                            <SelectItem key={m.id} value={m.id.toString()}>
                                                                {mDate} - {m.tani1 || "Tanı girilmemiş"}
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Hizmet Seçimi (Otomatik Doldur)</Label>
                                            <Select value={selectedServiceId || ''} onValueChange={handleHizmetSelect}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Listeden seçiniz..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {hizmetler.map(h => (
                                                        <SelectItem key={h.id} value={String(h.id)}>
                                                            {h.ad} - {h.varsayilan_fiyat ? Number(h.varsayilan_fiyat).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'} {getCurrencySymbol(h.para_birimi)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Açıklama / İşlem Adı</Label>
                                            <Input
                                                value={formData.aciklama || ''}
                                                onChange={(e) => setFormData({ ...formData, aciklama: e.target.value })}
                                                placeholder="İşlem detayını giriniz..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tutar (Borç)</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={formData.borc || ''}
                                                    onChange={(e) => setFormData({ ...formData, borc: parseFloat(e.target.value) })}
                                                    className="pl-8 font-bold"
                                                />
                                                <span className="absolute left-3 top-2.5 text-slate-400">₺</span>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="tahsilat" className="space-y-4 mt-0">
                                        <div className="space-y-2">
                                            <Label>Ödeme Yöntemi</Label>
                                            <Select
                                                value={formData.odeme_yontemi}
                                                onValueChange={(val) => setFormData({ ...formData, odeme_yontemi: val, kasa_id: undefined })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Önce yöntem seçin..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Nakit">Nakit</SelectItem>
                                                    <SelectItem value="Kredi Kartı">Kredi Kartı</SelectItem>
                                                    <SelectItem value="Havale/EFT">Havale/EFT</SelectItem>
                                                    <SelectItem value="Çek/Senet">Çek/Senet</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Kasa / Hesap Seçimi ({formData.para_birimi})</Label>
                                            <Select
                                                value={formData.kasa_id ? String(formData.kasa_id) : undefined}
                                                onValueChange={(val) => setFormData({ ...formData, kasa_id: Number(val) })}
                                                disabled={!formData.odeme_yontemi}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={!formData.odeme_yontemi ? "Önce yöntem seçin" : "Hesap seçin..."} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {kasalar
                                                        .filter(k => {
                                                            if (k.para_birimi !== formData.para_birimi) return false;

                                                            const method = formData.odeme_yontemi;
                                                            if (method === 'Nakit' && k.tip !== 'NAKIT') return false;
                                                            if (method === 'Kredi Kartı' && k.tip !== 'POS') return false;
                                                            if (method === 'Havale/EFT' && k.tip !== 'BANKA') return false;

                                                            return true;
                                                        })
                                                        .map(k => (
                                                            <SelectItem key={k.id} value={String(k.id)}>
                                                                {k.ad} ({k.para_birimi})
                                                            </SelectItem>
                                                        ))
                                                    }
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Input
                                                value={formData.aciklama || ''}
                                                onChange={(e) => setFormData({ ...formData, aciklama: e.target.value })}
                                                placeholder="Örn: 1. Taksit, Peşinat vb."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tutar (Tahsilat)</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={formData.alacak || ''}
                                                    onChange={(e) => setFormData({ ...formData, alacak: parseFloat(e.target.value) })}
                                                    className="pl-8 text-emerald-600 font-bold"
                                                />
                                                <span className="absolute left-3 top-2.5 text-slate-400">₺</span>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </div>
                            </Tabs>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setTransactionDialogOpen(false)}>İptal</Button>
                                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Kaydet
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tarih</TableHead>
                                    <TableHead>İşlem / Açıklama</TableHead>
                                    <TableHead>Detay</TableHead>
                                    <TableHead className="text-right text-slate-600">Hizmet</TableHead>
                                    <TableHead className="text-right text-emerald-600">Tahsilat</TableHead>
                                    <TableHead className="text-right font-bold text-slate-900">Genel Bakiye</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                                        </TableCell>
                                    </TableRow>
                                ) : sortedHareketler.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                                            Kayıt bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedHareketler.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-slate-50">
                                            <TableCell className="font-mono text-xs">
                                                {item.tarih ? format(parseISO(item.tarih), 'dd.MM.yyyy') : '-'}
                                                <div className="text-[10px] text-slate-400">{item.referans_kodu}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-slate-900">{item.aciklama || item.kategori_adi || 'Diğer İşlem'}</div>
                                                {item.satirlar && item.satirlar.length > 0 && (
                                                    <div className="text-xs text-slate-500 mt-0.5">
                                                        {item.satirlar.map(s => s.hizmet_adi).join(', ')}
                                                    </div>
                                                )}
                                                <div className="text-xs text-slate-500">{item.doktor ? `Dr. ${item.doktor}` : ''}</div>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-500">
                                                {/* Detail Info */}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-slate-700">
                                                {item.net_tutar > 0 ? item.net_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-emerald-600">
                                                {item.paid_amount > 0 ? item.paid_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-'}
                                            </TableCell>
                                            <TableCell className={cn("text-right font-bold", item.bakiye && item.bakiye > 0 ? "text-red-600" : "text-emerald-600")}>
                                                {item.bakiye ? item.bakiye.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00'} ₺
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(item)}>
                                                        <Printer className="h-4 w-4 text-slate-400" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                                                        <Pencil className="h-4 w-4 text-blue-500" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => setDeleteId(item.id!)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-rose-400" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Kaydı Sil</AlertDialogTitle>
                            <AlertDialogDescription>
                                Bu finansal işlem kaydını silmek üzeresiniz. Bakiye yeniden hesaplanacaktır.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                            >
                                Sil
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </div >
    );
}
