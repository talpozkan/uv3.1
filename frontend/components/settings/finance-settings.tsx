"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, KasaTanim, KasaTanimCreate, HizmetTanim, HizmetTanimCreate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Wallet, Stethoscope, Search, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function FinanceSettings() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <KasaManagement />
                <HizmetManagement />
            </div>
        </div>
    );
}

function KasaManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newKasa, setNewKasa] = useState<KasaTanimCreate>({
        ad: "",
        tip: "NAKIT",
        para_birimi: "TL",
        aktif: true
    });

    const { data: kasalar = [], isLoading } = useQuery({
        queryKey: ['kasalar'],
        queryFn: api.finance.getKasalar
    });

    const createMutation = useMutation({
        mutationFn: api.finance.createKasa,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kasalar'] });
            toast.success("Kasa/Hesap başarıyla oluşturuldu.");
            setIsDialogOpen(false);
            setNewKasa({ ad: "", tip: "NAKIT", para_birimi: "TL", aktif: true });
        },
        onError: () => toast.error("Kayıt oluşturulamadı.")
    });

    const handleCreate = () => {
        if (!newKasa.ad) {
            toast.error("Hesap adı zorunludur.");
            return;
        }
        createMutation.mutate(newKasa);
    };

    const deleteMutation = useMutation({
        mutationFn: api.finance.deleteAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kasalar'] });
            toast.success("Kasa silindi.");
        },
        onError: () => toast.error("Kasa silinemedi. Hareketleri olabilir.")
    });

    const handleDelete = async (id: number) => {
        if (window.confirm("Bu kasayı silmek istediğinize emin misiniz?")) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-emerald-600" />
                        Kasa ve Hesaplar
                    </CardTitle>
                    <CardDescription>Ödeme alınacak hesap tanımları</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Plus className="h-4 w-4 mr-1" /> Yeni Ekle
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Kasa/Hesap Ekle</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Hesap Adı</Label>
                                <Input
                                    placeholder="Örn: Garanti Bankası POS"
                                    value={newKasa.ad}
                                    onChange={(e) => setNewKasa({ ...newKasa, ad: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Hesap Tipi</Label>
                                    <Select
                                        value={newKasa.tip}
                                        onValueChange={(val) => setNewKasa({ ...newKasa, tip: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NAKIT">Nakit Kasa</SelectItem>
                                            <SelectItem value="BANKA">Banka Hesabı (Havale/EFT)</SelectItem>
                                            <SelectItem value="POS">POS Cihazı / Sanal POS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Para Birimi</Label>
                                    <Select
                                        value={newKasa.para_birimi}
                                        onValueChange={(val) => setNewKasa({ ...newKasa, para_birimi: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TL">Türk Lirası (₺)</SelectItem>
                                            <SelectItem value="USD">Amerikan Doları ($)</SelectItem>
                                            <SelectItem value="EUR">Euro (€)</SelectItem>
                                            <SelectItem value="GBP">Sterlin (£)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                    id="kasa-aktif"
                                    checked={newKasa.aktif}
                                    onCheckedChange={(checked) => setNewKasa({ ...newKasa, aktif: checked })}
                                />
                                <Label htmlFor="kasa-aktif">Hesap Aktif</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>İptal</Button>
                            <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Kaydet
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="flex-1">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hesap Adı</TableHead>
                                    <TableHead>Tip</TableHead>
                                    <TableHead className="w-[80px]">Döviz</TableHead>
                                    <TableHead className="w-[80px]">Durum</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {kasalar.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                            Kayıt bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    kasalar.map((kasa) => (
                                        <TableRow key={kasa.id}>
                                            <TableCell className="font-medium">{kasa.ad}</TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full font-bold",
                                                    kasa.tip === 'NAKIT' ? "bg-green-100 text-green-700" :
                                                        kasa.tip === 'POS' ? "bg-purple-100 text-purple-700" :
                                                            "bg-blue-100 text-blue-700"
                                                )}>
                                                    {kasa.tip}
                                                </span>
                                            </TableCell>
                                            <TableCell>{kasa.para_birimi}</TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "w-2 h-2 rounded-full block mx-auto",
                                                    kasa.aktif ? "bg-green-500" : "bg-slate-300"
                                                )} />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(kasa.id)}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function HizmetManagement() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: 'kod' | 'ad' | 'fiyat'; direction: 'asc' | 'desc' } | null>(null);
    const [newHizmet, setNewHizmet] = useState<HizmetTanimCreate>({
        ad: "",
        kod: "",
        fiyat: 0,
        para_birimi: "TL",
        kdv_orani: 0,
        aktif: true
    });

    const { data: hizmetler = [], isLoading } = useQuery({
        queryKey: ['hizmetler'],
        queryFn: api.finance.getHizmetler
    });

    const createMutation = useMutation({
        mutationFn: api.finance.createHizmet,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['hizmetler'] });
            toast.success("Hizmet başarıyla oluşturuldu.");
            setIsDialogOpen(false);
            setNewHizmet({ ad: "", kod: "", fiyat: 0, para_birimi: "TL", kdv_orani: 0, aktif: true });
        },
        onError: () => toast.error("Kayıt oluşturulamadı.")
    });

    const handleCreate = () => {
        if (!newHizmet.ad) {
            toast.error("Hizmet adı zorunludur.");
            return;
        }
        createMutation.mutate(newHizmet);
    };

    const handleSort = (key: 'kod' | 'ad' | 'fiyat') => {
        setSortConfig(current => {
            if (current?.key === key) {
                if (current.direction === 'asc') {
                    return { key, direction: 'desc' };
                }
                return null; // Reset sorting
            }
            return { key, direction: 'asc' };
        });
    };

    const getSortIcon = (key: 'kod' | 'ad' | 'fiyat') => {
        if (sortConfig?.key !== key) {
            return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-slate-400" />;
        }
        if (sortConfig.direction === 'asc') {
            return <ArrowUp className="h-3.5 w-3.5 ml-1 text-blue-600" />;
        }
        return <ArrowDown className="h-3.5 w-3.5 ml-1 text-blue-600" />;
    };

    const filteredHizmetler = hizmetler.filter(h =>
        h.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (h.kod && h.kod.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedHizmetler = [...filteredHizmetler].sort((a, b) => {
        if (!sortConfig) return 0;

        const { key, direction } = sortConfig;
        let aValue: string | number = '';
        let bValue: string | number = '';

        if (key === 'kod') {
            aValue = (a.kod || '').toLowerCase();
            bValue = (b.kod || '').toLowerCase();
        } else if (key === 'ad') {
            aValue = a.ad.toLowerCase();
            bValue = b.ad.toLowerCase();
        } else if (key === 'fiyat') {
            aValue = a.fiyat || 0;
            bValue = b.fiyat || 0;
        }

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Stethoscope className="h-5 w-5 text-blue-600" />
                        Hizmet Fiyat Listesi
                    </CardTitle>
                    <CardDescription>Muayene, işlem ve operasyon fiyatları</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Plus className="h-4 w-4 mr-1" /> Yeni Ekle
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Yeni Hizmet/İşlem Ekle</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>Hizmet Adı</Label>
                                    <Input
                                        placeholder="Örn: Üroloji Muayenesi"
                                        value={newHizmet.ad}
                                        onChange={(e) => setNewHizmet({ ...newHizmet, ad: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Prosedür Kodu (Opsiyonel)</Label>
                                        <Input
                                            placeholder="Örn: 704.210"
                                            value={newHizmet.kod || ''}
                                            onChange={(e) => setNewHizmet({ ...newHizmet, kod: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fiyat</Label>
                                        <Input
                                            type="number"
                                            value={newHizmet.fiyat}
                                            onChange={(e) => setNewHizmet({ ...newHizmet, fiyat: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Para Birimi</Label>
                                        <Select
                                            value={newHizmet.para_birimi}
                                            onValueChange={(val) => setNewHizmet({ ...newHizmet, para_birimi: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="TL">Türk Lirası (₺)</SelectItem>
                                                <SelectItem value="USD">Amerikan Doları ($)</SelectItem>
                                                <SelectItem value="EUR">Euro (€)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>KDV Oranı (%)</Label>
                                        <Input
                                            type="number"
                                            value={newHizmet.kdv_orani}
                                            onChange={(e) => setNewHizmet({ ...newHizmet, kdv_orani: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Switch
                                        id="hizmet-aktif"
                                        checked={newHizmet.aktif}
                                        onCheckedChange={(checked) => setNewHizmet({ ...newHizmet, aktif: checked })}
                                    />
                                    <Label htmlFor="hizmet-aktif">Hizmet Aktif</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>İptal</Button>
                                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Kaydet
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Hizmetlerde ara..."
                        className="pl-9 bg-slate-50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : (
                    <div className="rounded-md border h-[300px] overflow-auto relative">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                                <TableRow>
                                    <TableHead>
                                        <button
                                            onClick={() => handleSort('kod')}
                                            className="flex items-center hover:text-blue-600 transition-colors font-medium"
                                        >
                                            Kod
                                            {getSortIcon('kod')}
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            onClick={() => handleSort('ad')}
                                            className="flex items-center hover:text-blue-600 transition-colors font-medium"
                                        >
                                            Hizmet Adı
                                            {getSortIcon('ad')}
                                        </button>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <button
                                            onClick={() => handleSort('fiyat')}
                                            className="flex items-center justify-end w-full hover:text-blue-600 transition-colors font-medium"
                                        >
                                            Birim Fiyat
                                            {getSortIcon('fiyat')}
                                        </button>
                                    </TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedHizmetler.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                                            Kayıt bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedHizmetler.map((hizmet) => (
                                        <TableRow key={hizmet.id}>
                                            <TableCell className="font-mono text-xs text-slate-500">{hizmet.kod || '-'}</TableCell>
                                            <TableCell className="font-medium">{hizmet.ad}</TableCell>
                                            <TableCell className="text-right font-bold text-slate-700">
                                                {hizmet.fiyat?.toLocaleString('tr-TR')} {hizmet.para_birimi}
                                            </TableCell>
                                            <TableCell>
                                                {!hizmet.aktif && <span className="w-2 h-2 rounded-full bg-slate-300 block" title="Pasif" />}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
