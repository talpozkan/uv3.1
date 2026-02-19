import React from "react";
import { HabitsData } from "./schema";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SystemQueryCombobox } from "@/components/ui/system-query-combobox";

interface HabitsFormProps {
    value: HabitsData;
    onChange: (data: HabitsData) => void;
    readOnly?: boolean;
}

export const HabitsForm: React.FC<HabitsFormProps> = ({
    value,
    onChange,
    readOnly = false
}) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
                <Label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Alışkanlıklar</Label>
                <Separator className="flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <SystemQueryCombobox
                        label="Sigara"
                        value={value.sigara}
                        onChange={(val) => onChange({ ...value, sigara: val })}
                        options={[
                            "Kullanmıyor",
                            "Bırakmış",
                            "1 Paket/Yıl",
                            "5 Paket/Yıl",
                            "10 Paket/Yıl",
                            "20 Paket/Yıl",
                            "30+ Paket/Yıl"
                        ]}
                        placeholder="Paket/Yıl"
                        disabled={readOnly}
                    />
                </div>
                <div className="space-y-1.5">
                    <SystemQueryCombobox
                        label="Alkol"
                        value={value.alkol}
                        onChange={(val) => onChange({ ...value, alkol: val })}
                        options={[
                            "Kullanmıyor",
                            "Sosyal",
                            "Haftada < 3 gün",
                            "Haftada > 3 gün",
                            "Hergün düzenli",
                            "Alkolizm",
                            "Alkolizm sonrası bırakmış"
                        ]}
                        disabled={readOnly}
                    />
                </div>
            </div>
        </div>
    );
};
