"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Pill, Tablets, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface DefinitionItem {
    id: string;
    value: string;
}

interface DrugItem {
    name: string;
    boxQty: string;
    dose: string;
    period: string;
    usage: string;
    description: string;
}

interface PrescriptionTemplate {
    templateName: string;
    drugs: DrugItem[];
}

export function PrescriptionTemplateSettings({ items, onChange }: { items: DefinitionItem[], onChange: (items: DefinitionItem[]) => void }) {
    const [templates, setTemplates] = useState<{ id: string, data: PrescriptionTemplate }[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Temp state for adding a drug in the editor
    const [newDrug, setNewDrug] = useState<DrugItem>({
        name: "",
        boxQty: "1",
        dose: "1x1",
        period: "",
        usage: "Tok",
        description: ""
    });

    // Dose split state for UI
    const [dose1, setDose1] = useState("1");
    const [dose2, setDose2] = useState("1");

    useEffect(() => {
        setNewDrug(prev => ({ ...prev, dose: `${dose1}x${dose2}` }));
    }, [dose1, dose2]);

    useEffect(() => {
        const parsed = items.map(item => {
            let data: PrescriptionTemplate = { templateName: "", drugs: [] };
            try {
                const json = JSON.parse(item.value);
                if (typeof json === 'object') {
                    data = { ...data, ...json };
                } else {
                    data.templateName = item.value;
                }
            } catch (e) {
                data.templateName = item.value;
            }
            return { id: item.id, data };
        });
        setTemplates(parsed);
        if (parsed.length > 0 && !selectedId) {
            setSelectedId(parsed[0].id);
        }
    }, [items]);

    const handleUpdateName = (id: string, name: string) => {
        const updated = templates.map(t => {
            if (t.id === id) {
                return { ...t, data: { ...t.data, templateName: name } };
            }
            return t;
        });
        setTemplates(updated);
        syncToParent(updated);
    };

    const handleAddDrug = () => {
        if (!selectedId || !newDrug.name) return;

        const updated = templates.map(t => {
            if (t.id === selectedId) {
                return { ...t, data: { ...t.data, drugs: [...t.data.drugs, newDrug] } };
            }
            return t;
        });
        setTemplates(updated);
        setNewDrug({ name: "", boxQty: "1", dose: `1x1`, period: "", usage: "Tok", description: "" });
        setDose1("1");
        setDose2("1");
        syncToParent(updated);
    };

    const handleRemoveDrug = (drugIndex: number) => {
        if (!selectedId) return;
        const updated = templates.map(t => {
            if (t.id === selectedId) {
                const newDrugs = t.data.drugs.filter((_, i) => i !== drugIndex);
                return { ...t, data: { ...t.data, drugs: newDrugs } };
            }
            return t;
        });
        setTemplates(updated);
        syncToParent(updated);
    };

    const handleAddTemplate = () => {
        const newId = crypto.randomUUID();
        const newTemplate = {
            id: newId,
            data: { templateName: "Yeni Şablon", drugs: [] }
        };
        const updated = [...templates, newTemplate];
        setTemplates(updated);
        setSelectedId(newId);
        syncToParent(updated);
    };

    const handleDeleteTemplate = (id: string) => {
        const updated = templates.filter(t => t.id !== id);
        setTemplates(updated);
        if (selectedId === id) {
            setSelectedId(updated.length > 0 ? updated[0].id : null);
        }
        syncToParent(updated);
    };

    const syncToParent = (tmps: { id: string, data: PrescriptionTemplate }[]) => {
        const newItems = tmps.map(t => ({
            id: t.id,
            value: JSON.stringify(t.data)
        }));
        onChange(newItems);
    };

    const selectedTemplate = templates.find(t => t.id === selectedId);

    return (
        <div className="grid grid-cols-12 gap-6 h-[600px]">
            {/* Template List */}
            <div className="col-span-4 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Şablonlar</h3>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-emerald-50 hover:text-emerald-600" onClick={handleAddTemplate}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {templates.map(tmp => (
                        <button
                            key={tmp.id}
                            onClick={() => setSelectedId(tmp.id)}
                            className={cn(
                                "w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-3",
                                selectedId === tmp.id ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-100/50"
                            )}
                        >
                            <FileSignature className={cn("w-4 h-4", selectedId === tmp.id ? "text-emerald-500" : "text-slate-400")} />
                            <span className="truncate">{tmp.data.templateName || "İsimsiz Şablon"}</span>
                            <span className="text-xs text-slate-300 ml-auto">{tmp.data.drugs.length} ilaç</span>
                        </button>
                    ))}
                    {templates.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                            Henüz şablon eklenmemiş.
                        </div>
                    )}
                </div>
            </div>

            {/* Template Editor */}
            <div className="col-span-8">
                {selectedTemplate ? (
                    <Card className="h-full border-slate-200 shadow-sm flex flex-col">
                        <div className="flex-1 p-6 space-y-6 flex flex-col h-full overflow-hidden">
                            {/* Header */}
                            <div className="space-y-4 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <FileSignature className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div className="flex-1">
                                        <Label className="text-[10px] uppercase text-slate-400 font-bold">Şablon Adı</Label>
                                        <Input
                                            value={selectedTemplate.data.templateName}
                                            onChange={(e) => handleUpdateName(selectedTemplate.id, e.target.value)}
                                            className="font-bold border-none shadow-none text-lg px-0 h-8 focus-visible:ring-0"
                                            placeholder="Şablon Adı"
                                        />
                                    </div>
                                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteTemplate(selectedTemplate.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Drug List Table */}
                            <div className="flex-1 overflow-auto rounded-lg border border-slate-100 bg-white shadow-sm">
                                <Table>
                                    <TableHeader className="bg-slate-50 sticky top-0">
                                        <TableRow className="uppercase text-[10px] tracking-wider hover:bg-slate-50">
                                            <TableHead className="w-8">#</TableHead>
                                            <TableHead>İlaç Adı</TableHead>
                                            <TableHead className="text-center">Doz</TableHead>
                                            <TableHead className="text-center">Kutu</TableHead>
                                            <TableHead>Periyod</TableHead>
                                            <TableHead>Kullanım</TableHead>
                                            <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedTemplate.data.drugs.map((drug, idx) => (
                                            <TableRow key={idx} className="text-xs">
                                                <TableCell className="text-slate-400 font-mono">{idx + 1}</TableCell>
                                                <TableCell className="font-bold">{drug.name}</TableCell>
                                                <TableCell className="text-center font-mono">{drug.dose}</TableCell>
                                                <TableCell className="text-center font-mono">{drug.boxQty}</TableCell>
                                                <TableCell>{drug.period}</TableCell>
                                                <TableCell>{drug.usage}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-red-500" onClick={() => handleRemoveDrug(idx)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {selectedTemplate.data.drugs.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center text-slate-400 text-xs italic">
                                                    Bu şablonda ilaç yok. Aşağıdan ekleyin.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Add Drug Form */}
                            <div className=" pt-4 border-t border-slate-100 bg-slate-50/50 p-4 rounded-lg">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Plus className="w-3 h-3" /> İlaç Ekle
                                </h4>
                                <div className="grid grid-cols-12 gap-3 items-end">
                                    <div className="col-span-4 space-y-1">
                                        <Label className="text-[10px]">İlaç Adı</Label>
                                        <Input
                                            value={newDrug.name}
                                            onChange={e => setNewDrug({ ...newDrug, name: e.target.value })}
                                            className="h-8 text-xs bg-white"
                                            placeholder="İlaç Adı..."
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-[10px] text-center w-full block">Doz</Label>
                                        <div className="flex items-center gap-1">
                                            <Input
                                                value={dose1}
                                                onChange={e => setDose1(e.target.value)}
                                                className="h-8 text-xs text-center p-0 bg-white"
                                                placeholder="1"
                                            />
                                            <span className="text-xs text-slate-400">x</span>
                                            <Input
                                                value={dose2}
                                                onChange={e => setDose2(e.target.value)}
                                                className="h-8 text-xs text-center p-0 bg-white"
                                                placeholder="1"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-1 space-y-1">
                                        <Label className="text-[10px] text-center w-full block">Kutu</Label>
                                        <Input
                                            value={newDrug.boxQty}
                                            onChange={e => setNewDrug({ ...newDrug, boxQty: e.target.value })}
                                            className="h-8 text-xs text-center bg-white"
                                            placeholder="1"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-[10px]">Periyod (Süre)</Label>
                                        <Input
                                            value={newDrug.period}
                                            onChange={e => setNewDrug({ ...newDrug, period: e.target.value })}
                                            className="h-8 text-xs bg-white"
                                            placeholder="Süre"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-[10px]">Kullanım</Label>
                                        <Input
                                            value={newDrug.usage}
                                            onChange={e => setNewDrug({ ...newDrug, usage: e.target.value })}
                                            className="h-8 text-xs bg-white"
                                            placeholder="Tok"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <Button
                                            onClick={handleAddDrug}
                                            disabled={!newDrug.name}
                                            className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        Şablon seçin veya yeni oluşturun.
                    </div>
                )}
            </div>
        </div>
    );
}
