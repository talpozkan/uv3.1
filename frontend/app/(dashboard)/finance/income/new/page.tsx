'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    TrendingUp,
    Search,
    Plus,
    Trash2,
    Save,
    Calendar,
    User,
    CreditCard,
    Banknote,
    Building2,
    X
} from 'lucide-react';
import Link from 'next/link';
import { api, FinansKategori, FinansHizmet, FinansKasa, Patient } from '@/lib/api';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ServiceLine {
    id: string;
    hizmet_id?: number;
    hizmet_adi: string;
    adet: number;
    birim_fiyat: number;
    toplam: number;
}

interface PaymentLine {
    id: string;
    kasa_id?: number;
    odeme_yontemi: string;
    tutar: number;
    taksit_sayisi: number;
}

const PAYMENT_METHODS = [
    { value: 'nakit', label: 'Nakit', icon: Banknote },
    { value: 'kredi_karti', label: 'Kredi Kartı', icon: CreditCard },
    { value: 'havale', label: 'Havale/EFT', icon: Building2 },
    { value: 'sgk', label: 'SGK', icon: Building2 },
    { value: 'ozel_sigorta', label: 'Özel Sigorta', icon: Building2 },
];

export default function NewIncomePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Data
    const [categories, setCategories] = useState<FinansKategori[]>([]);
    const [services, setServices] = useState<FinansHizmet[]>([]);
    const [accounts, setAccounts] = useState<FinansKasa[]>([]);

    // Form State
    const [tarih, setTarih] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [paraBirimi, setParaBirimi] = useState('TRY');
    const [kategoriId, setKategoriId] = useState<string>('');
    const [aciklama, setAciklama] = useState('');
    const [doktor, setDoktor] = useState('');
    const [notlar, setNotlar] = useState('');
    const [vadeTarihi, setVadeTarihi] = useState('');

    // Hasta Seçimi
    const [hastaId, setHastaId] = useState<string | null>(null);
    const [hastaAdi, setHastaAdi] = useState('');
    const [hastaSearchQuery, setHastaSearchQuery] = useState('');
    const [hastaSearchResults, setHastaSearchResults] = useState<Patient[]>([]);
    const [showHastaSearch, setShowHastaSearch] = useState(false);

    // Satırlar
    const [serviceLines, setServiceLines] = useState<ServiceLine[]>([
        { id: '1', hizmet_adi: '', adet: 1, birim_fiyat: 0, toplam: 0 }
    ]);

    // Ödemeler
    const [payments, setPayments] = useState<PaymentLine[]>([]);
    const [showPaymentForm, setShowPaymentForm] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [categoriesRes, servicesRes, accountsRes] = await Promise.all([
                    api.finance.getCategories('gelir'),
                    api.finance.getServices(),
                    api.finance.getAccounts()
                ]);
                setCategories(categoriesRes);
                setServices(servicesRes);
                setAccounts(accountsRes);
            } catch (error) {
                console.error('Veriler yüklenemedi:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Hasta Arama
    useEffect(() => {
        const searchPatients = async () => {
            if (hastaSearchQuery.length < 2) {
                setHastaSearchResults([]);
                return;
            }
            try {
                const results = await api.patients.list({ search: hastaSearchQuery, limit: 10 });
                setHastaSearchResults(results);
            } catch (error) {
                console.error('Hasta araması başarısız:', error);
            }
        };

        const debounce = setTimeout(searchPatients, 300);
        return () => clearTimeout(debounce);
    }, [hastaSearchQuery]);

    const selectPatient = (patient: Patient) => {
        setHastaId(patient.id);
        setHastaAdi(`${patient.ad} ${patient.soyad}`);
        setShowHastaSearch(false);
        setHastaSearchQuery('');
        setHastaSearchResults([]);
    };

    const clearPatient = () => {
        setHastaId(null);
        setHastaAdi('');
    };

    // Satır Yönetimi
    const addServiceLine = () => {
        setServiceLines([
            ...serviceLines,
            { id: Date.now().toString(), hizmet_adi: '', adet: 1, birim_fiyat: 0, toplam: 0 }
        ]);
    };

    const removeServiceLine = (id: string) => {
        if (serviceLines.length > 1) {
            setServiceLines(serviceLines.filter(line => line.id !== id));
        }
    };

    const updateServiceLine = (id: string, field: keyof ServiceLine, value: any) => {
        setServiceLines(serviceLines.map(line => {
            if (line.id === id) {
                const updated = { ...line, [field]: value };
                if (field === 'adet' || field === 'birim_fiyat') {
                    updated.toplam = updated.adet * updated.birim_fiyat;
                }
                return updated;
            }
            return line;
        }));
    };

    const selectService = (lineId: string, serviceId: number) => {
        const service = services.find(s => s.id === serviceId);
        if (service) {
            setServiceLines(serviceLines.map(line => {
                if (line.id === lineId) {
                    return {
                        ...line,
                        hizmet_id: service.id,
                        hizmet_adi: service.ad,
                        birim_fiyat: service.varsayilan_fiyat || 0,
                        toplam: line.adet * (service.varsayilan_fiyat || 0)
                    };
                }
                return line;
            }));
        }
    };

    // Ödeme Yönetimi
    const addPayment = (method: string) => {
        const defaultAccount = accounts.find(a =>
            (method === 'nakit' && a.tip === 'NAKIT' && a.para_birimi === paraBirimi) ||
            (method === 'kredi_karti' && a.tip === 'POS' && a.para_birimi === paraBirimi) ||
            (method === 'havale' && a.tip === 'BANKA' && a.para_birimi === paraBirimi)
        );

        setPayments([
            ...payments,
            {
                id: Date.now().toString(),
                kasa_id: defaultAccount?.id,
                odeme_yontemi: method,
                tutar: totalAmount - totalPayments,
                taksit_sayisi: 1
            }
        ]);
        setShowPaymentForm(false);
    };

    const removePayment = (id: string) => {
        setPayments(payments.filter(p => p.id !== id));
    };

    const updatePayment = (id: string, field: keyof PaymentLine, value: any) => {
        setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    // Hesaplamalar
    const totalAmount = serviceLines.reduce((sum, line) => sum + line.toplam, 0);
    const totalPayments = payments.reduce((sum, p) => sum + p.tutar, 0);
    const remainingAmount = totalAmount - totalPayments;

    // Kaydet
    const handleSubmit = async () => {
        if (serviceLines.every(l => !l.hizmet_adi || l.toplam === 0)) {
            toast.error('En az bir hizmet satırı ekleyin');
            return;
        }

        setSaving(true);
        try {
            const data = {
                hasta_id: hastaId || undefined,
                tarih,
                islem_tipi: 'gelir',
                durum: remainingAmount > 0 ? 'bekliyor' : 'tamamlandi',
                kategori_id: kategoriId ? parseInt(kategoriId) : undefined,
                aciklama: aciklama || hastaAdi || 'Gelir',
                tutar: totalAmount,
                para_birimi: paraBirimi,
                kdv_orani: 0,
                kdv_tutari: 0,
                net_tutar: totalAmount,
                doktor,
                vade_tarihi: vadeTarihi || undefined,
                notlar,
                satirlar: serviceLines
                    .filter(l => l.hizmet_adi && l.toplam > 0)
                    .map(l => ({
                        hizmet_id: l.hizmet_id,
                        hizmet_adi: l.hizmet_adi,
                        adet: l.adet,
                        birim_fiyat: l.birim_fiyat,
                        toplam: l.toplam,
                        doktor
                    })),
                odemeler: payments.map(p => ({
                    kasa_id: p.kasa_id,
                    odeme_tarihi: tarih,
                    tutar: p.tutar,
                    odeme_yontemi: p.odeme_yontemi,
                    taksit_sayisi: p.taksit_sayisi
                }))
            };

            await api.finance.createTransaction(data);
            toast.success('Gelir kaydı oluşturuldu');
            router.push('/finance');
        } catch (error) {
            console.error('Kayıt hatası:', error);
            toast.error('Kayıt oluşturulamadı');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: paraBirimi,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <p className="text-slate-500">Yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link href="/finance">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp className="h-6 w-6 text-emerald-600" />
                            Yeni Gelir Kaydı
                        </h1>
                        <p className="text-slate-500 text-sm">Muayene ücreti, işlem ücreti vb.</p>
                    </div>
                </div>
                <Button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700"
                >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sol Panel - Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Temel Bilgiler */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Temel Bilgiler</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Tarih</Label>
                                    <Input
                                        type="date"
                                        value={tarih}
                                        onChange={(e) => setTarih(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Para Birimi</Label>
                                    <Select value={paraBirimi} onValueChange={(val) => {
                                        setParaBirimi(val);
                                        setPayments([]); // Currency değişince ödemeleri sıfırla
                                    }}>
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
                                <div>
                                    <Label>Kategori</Label>
                                    <Select value={kategoriId} onValueChange={setKategoriId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seçin..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                                    {cat.ad}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Hasta Seçimi */}
                            <div>
                                <Label>Hasta (Opsiyonel)</Label>
                                {hastaId ? (
                                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                        <User className="h-4 w-4 text-emerald-600" />
                                        <span className="font-medium text-emerald-800">{hastaAdi}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearPatient}
                                            className="ml-auto text-emerald-600"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Hasta ara..."
                                                className="pl-10"
                                                value={hastaSearchQuery}
                                                onChange={(e) => {
                                                    setHastaSearchQuery(e.target.value);
                                                    setShowHastaSearch(true);
                                                }}
                                                onFocus={() => setShowHastaSearch(true)}
                                            />
                                        </div>
                                        {showHastaSearch && hastaSearchResults.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                                {hastaSearchResults.map(patient => (
                                                    <button
                                                        key={patient.id}
                                                        className="w-full px-4 py-2 text-left hover:bg-slate-50 border-b last:border-0"
                                                        onClick={() => selectPatient(patient)}
                                                    >
                                                        <p className="font-medium">{patient.ad} {patient.soyad}</p>
                                                        <p className="text-sm text-slate-500">{patient.tc_kimlik}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label>Açıklama</Label>
                                <Input
                                    placeholder="Örn: Muayene ücreti, ESWL vb."
                                    value={aciklama}
                                    onChange={(e) => setAciklama(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Hizmet Satırları */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Hizmetler</CardTitle>
                            <Button variant="outline" size="sm" onClick={addServiceLine}>
                                <Plus className="h-4 w-4 mr-1" /> Satır Ekle
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {serviceLines.map((line, index) => (
                                    <div key={line.id} className="flex gap-3 items-end p-3 bg-slate-50 rounded-lg">
                                        <div className="flex-1">
                                            <Label className="text-xs">Hizmet</Label>
                                            <Select
                                                value={line.hizmet_id?.toString() || ''}
                                                onValueChange={(val) => selectService(line.id, parseInt(val))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Hizmet seçin..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {services.map(s => (
                                                        <SelectItem key={s.id} value={s.id.toString()}>
                                                            {s.ad} - {formatCurrency(s.varsayilan_fiyat || 0)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-20">
                                            <Label className="text-xs">Adet</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={line.adet}
                                                onChange={(e) => updateServiceLine(line.id, 'adet', parseInt(e.target.value) || 1)}
                                            />
                                        </div>
                                        <div className="w-32">
                                            <Label className="text-xs">Birim Fiyat</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={line.birim_fiyat}
                                                onChange={(e) => updateServiceLine(line.id, 'birim_fiyat', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="w-28 text-right">
                                            <Label className="text-xs">Toplam</Label>
                                            <p className="font-bold text-emerald-600 py-2">{formatCurrency(line.toplam)}</p>
                                        </div>
                                        {serviceLines.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeServiceLine(line.id)}
                                                className="text-rose-500"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ödemeler */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Ödemeler</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => setShowPaymentForm(!showPaymentForm)}>
                                <Plus className="h-4 w-4 mr-1" /> Ödeme Ekle
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {showPaymentForm && (
                                <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                                    <p className="text-sm font-medium mb-3">Ödeme Yöntemi Seçin</p>
                                    <div className="flex flex-wrap gap-2">
                                        {PAYMENT_METHODS.map(method => (
                                            <Button
                                                key={method.value}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => addPayment(method.value)}
                                                className="flex items-center gap-2"
                                            >
                                                <method.icon className="h-4 w-4" />
                                                {method.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {payments.map(payment => (
                                    <div key={payment.id} className="flex gap-3 items-end p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                        <div className="w-40">
                                            <Label className="text-xs">Yöntem</Label>
                                            <Badge variant="secondary" className="mt-1">
                                                {PAYMENT_METHODS.find(m => m.value === payment.odeme_yontemi)?.label}
                                            </Badge>
                                        </div>
                                        <div className="w-40">
                                            <Label className="text-xs">Kasa</Label>
                                            <Select
                                                value={payment.kasa_id?.toString() || ''}
                                                onValueChange={(val) => updatePayment(payment.id, 'kasa_id', parseInt(val))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seçin..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts
                                                        .filter(acc => {
                                                            // Filter by Currency
                                                            if (acc.para_birimi !== paraBirimi) return false;

                                                            // Filter by Method (Payment object knows its method)
                                                            if (payment.odeme_yontemi === 'nakit' && acc.tip !== 'NAKIT') return false;
                                                            if (payment.odeme_yontemi === 'kredi_karti' && acc.tip !== 'POS') return false;
                                                            if (payment.odeme_yontemi === 'havale' && acc.tip !== 'BANKA') return false;

                                                            return true;
                                                        })
                                                        .map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id.toString()}>
                                                                {acc.ad} ({formatCurrency(acc.bakiye)})
                                                            </SelectItem>
                                                        ))
                                                    }
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs">Tutar</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={payment.tutar}
                                                onChange={(e) => updatePayment(payment.id, 'tutar', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        {payment.odeme_yontemi === 'kredi_karti' && (
                                            <div className="w-24">
                                                <Label className="text-xs">Taksit</Label>
                                                <Select
                                                    value={payment.taksit_sayisi.toString()}
                                                    onValueChange={(val) => updatePayment(payment.id, 'taksit_sayisi', parseInt(val))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {[1, 2, 3, 4, 5, 6, 9, 12].map(n => (
                                                            <SelectItem key={n} value={n.toString()}>
                                                                {n === 1 ? 'Tek Çekim' : `${n} Taksit`}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removePayment(payment.id)}
                                            className="text-rose-500"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {payments.length === 0 && (
                                    <p className="text-slate-500 text-center py-4">Henüz ödeme eklenmedi</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notlar */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Ek Bilgiler</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Doktor</Label>
                                    <Input
                                        placeholder="Doktor adı"
                                        value={doktor}
                                        onChange={(e) => setDoktor(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Vade Tarihi (Opsiyonel)</Label>
                                    <Input
                                        type="date"
                                        value={vadeTarihi}
                                        onChange={(e) => setVadeTarihi(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Notlar</Label>
                                <Textarea
                                    placeholder="Ek notlar..."
                                    value={notlar}
                                    onChange={(e) => setNotlar(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sağ Panel - Özet */}
                <div className="lg:col-span-1">
                    <Card className="sticky top-6 border-emerald-200">
                        <CardHeader className="bg-emerald-50 rounded-t-lg">
                            <CardTitle className="text-lg text-emerald-800">Özet</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b">
                                <span className="text-slate-600">Toplam Tutar</span>
                                <span className="text-2xl font-bold text-slate-900">{formatCurrency(totalAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Ödenen</span>
                                <span className="font-medium text-emerald-600">{formatCurrency(totalPayments)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t">
                                <span className="text-slate-600 font-medium">Kalan</span>
                                <span className={`text-xl font-bold ${remainingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(remainingAmount)}
                                </span>
                            </div>

                            {remainingAmount > 0 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-amber-800 text-sm">
                                        <strong>Uyarı:</strong> Kalan tutar borç olarak kaydedilecek.
                                    </p>
                                </div>
                            )}

                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700"
                                onClick={handleSubmit}
                                disabled={saving}
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
