"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Stethoscope, User, GraduationCap, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DefinitionItem {
    id: string;
    value: string;
}

interface Doctor {
    adSoyad: string;
    brans: string;
    diplomaNo: string;
    tescilNo: string;
    uzmanlikTescilNo: string;
}

export function DoctorsSettings({ items, onChange }: { items: DefinitionItem[], onChange: (items: DefinitionItem[]) => void }) {
    const [doctors, setDoctors] = useState<{ id: string, data: Doctor }[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Parse items to doctors
    useEffect(() => {
        const parsed = items.map(item => {
            let data: Doctor = { adSoyad: "", brans: "", diplomaNo: "", tescilNo: "", uzmanlikTescilNo: "" };
            try {
                // Try to parse JSON
                const json = JSON.parse(item.value);
                if (typeof json === 'object') {
                    data = { ...data, ...json };
                } else {
                    // It was a simple string
                    data.adSoyad = item.value;
                }
            } catch (e) {
                // Not JSON, treat as string (legacy data)
                data.adSoyad = item.value;
            }
            return { id: item.id, data };
        });
        setDoctors(parsed);
        if (parsed.length > 0 && !selectedId) {
            setSelectedId(parsed[0].id);
        }
    }, [items]);

    const handleUpdate = (id: string, field: keyof Doctor, value: string) => {
        const updated = doctors.map(doc => {
            if (doc.id === id) {
                return { ...doc, data: { ...doc.data, [field]: value } };
            }
            return doc;
        });
        setDoctors(updated);
        // Propagate change
        syncToParent(updated);
    };

    const handleAdd = () => {
        const newId = crypto.randomUUID();
        const newDoc = {
            id: newId,
            data: { adSoyad: "Yeni Doktor", brans: "", diplomaNo: "", tescilNo: "", uzmanlikTescilNo: "" }
        };
        const updated = [...doctors, newDoc];
        setDoctors(updated);
        setSelectedId(newId);
        syncToParent(updated);
    };

    const handleDelete = (id: string) => {
        const updated = doctors.filter(d => d.id !== id);
        setDoctors(updated);
        if (selectedId === id) {
            setSelectedId(updated.length > 0 ? updated[0].id : null);
        }
        syncToParent(updated);
    };

    const syncToParent = (docs: { id: string, data: Doctor }[]) => {
        const newItems = docs.map(doc => ({
            id: doc.id,
            value: JSON.stringify(doc.data)
        }));
        onChange(newItems);
    };

    const selectedDoc = doctors.find(d => d.id === selectedId);

    return (
        <div className="grid grid-cols-12 gap-6 h-[600px]">
            {/* List Sidebar */}
            <div className="col-span-4 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Doktor Listesi</h3>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-emerald-50 hover:text-emerald-600" onClick={handleAdd}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {doctors.map(doc => (
                        <button
                            key={doc.id}
                            onClick={() => setSelectedId(doc.id)}
                            className={cn(
                                "w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-3",
                                selectedId === doc.id ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-100/50"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                selectedId === doc.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                            )}>
                                {doc.data.adSoyad.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="truncate">{doc.data.adSoyad || "İsimsiz Doktor"}</span>
                        </button>
                    ))}
                    {doctors.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                            Henüz doktor eklenmemiş.
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="col-span-8">
                {selectedDoc ? (
                    <Card className="h-full border-slate-200 shadow-sm flex flex-col">
                        <div className="flex-1 p-6 space-y-6">
                            <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <Stethoscope className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Doktor Bilgileri</h2>
                                    <p className="text-sm text-slate-500">Reçete ve raporlarda kullanılacak resmi bilgiler</p>
                                </div>
                                <div className="ml-auto">
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedDoc.id)}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Sil
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2 space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <User className="w-3.5 h-3.5" /> Adı Soyadı
                                    </Label>
                                    <Input
                                        value={selectedDoc.data.adSoyad}
                                        onChange={(e) => handleUpdate(selectedDoc.id, 'adSoyad', e.target.value)}
                                        className="font-bold text-lg"
                                        placeholder="Dr. Ad Soyad"
                                    />
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Building2 className="w-3.5 h-3.5" /> Branş
                                    </Label>
                                    <Input
                                        value={selectedDoc.data.brans}
                                        onChange={(e) => handleUpdate(selectedDoc.id, 'brans', e.target.value)}
                                        className="font-mono bg-slate-50"
                                        placeholder="Branş (Örn: Üroloji)"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <GraduationCap className="w-3.5 h-3.5" /> Diploma No
                                    </Label>
                                    <Input
                                        value={selectedDoc.data.diplomaNo}
                                        onChange={(e) => handleUpdate(selectedDoc.id, 'diplomaNo', e.target.value)}
                                        className="font-mono bg-slate-50"
                                        placeholder="Diploma No"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <GraduationCap className="w-3.5 h-3.5" /> Diploma Tescil No
                                    </Label>
                                    <Input
                                        value={selectedDoc.data.tescilNo}
                                        onChange={(e) => handleUpdate(selectedDoc.id, 'tescilNo', e.target.value)}
                                        className="font-mono bg-slate-50"
                                        placeholder="Tescil No"
                                    />
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <GraduationCap className="w-3.5 h-3.5" /> Uzmanlık Diploma Tescil No
                                    </Label>
                                    <Input
                                        value={selectedDoc.data.uzmanlikTescilNo}
                                        onChange={(e) => handleUpdate(selectedDoc.id, 'uzmanlikTescilNo', e.target.value)}
                                        className="font-mono bg-slate-50"
                                        placeholder="Uzmanlık Tescil No"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        Düzenlemek için soldan bir doktor seçin veya yeni ekleyin.
                    </div>
                )}
            </div>
        </div>
    );
}
