import React from "react";
import { SystemQueryData } from "./schema";
import { SystemQueryCombobox } from "@/components/ui/system-query-combobox";

interface SystemQueryFormProps {
    value: SystemQueryData;
    onChange: (data: SystemQueryData) => void;
    readOnly?: boolean;
}

export const SystemQueryForm: React.FC<SystemQueryFormProps> = ({
    value,
    onChange,
    readOnly = false
}) => {
    const updateField = (field: keyof SystemQueryData, val: string) => {
        onChange({ ...value, [field]: val });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-4">
                <SystemQueryCombobox
                    label="DİSÜRİ"
                    value={value.disuri || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("disuri", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="POLLAKİÜRİ"
                    value={value.pollakiuri_text || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("pollakiuri_text", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="NOKTÜRİ"
                    value={value.nokturi_text || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("nokturi_text", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="ATEŞ"
                    value={value.ates_sq || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("ates_sq", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="GENİTAL AKINTI"
                    value={value.genital_akinti || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("genital_akinti", v)}
                    options={["Yok", "Sarı", "Yeşil", "Hemoraji", "Şeffaf"]}
                />
                <SystemQueryCombobox
                    label="KABIZLIK"
                    value={value.kabizlik || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("kabizlik", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="TAŞ ÖYKÜSÜ"
                    value={value.tas_oyku || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("tas_oyku", v)}
                    options={["Yok", "Var"]}
                />
                <SystemQueryCombobox
                    label="HEMATÜRİ"
                    value={value.hematuri || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("hematuri", v)}
                    options={["Yok", "Var", "Pıhtılı"]}
                />
                <SystemQueryCombobox
                    label="ÇATALLANMA"
                    value={value.catallanma || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("catallanma", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
            </div>

            <div className="space-y-4">
                <SystemQueryCombobox
                    label="PROJEKSİYONDA AZALMA"
                    value={value.projeksiyon_azalma_sq || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("projeksiyon_azalma_sq", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="KALİBREDE İNCELME"
                    value={value.kalibre_incelme || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("kalibre_incelme", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="İDRARA BAŞLAMADA ZORLUK"
                    value={value.idrar_bas_zorluk_text || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("idrar_bas_zorluk_text", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="KESİK KESİK İDRAR YAPMA"
                    value={value.kesik_idrar_yapma_text || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("kesik_idrar_yapma_text", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="TERMİNAL DAMLAMA"
                    value={value.terminal_damlama || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("terminal_damlama", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="RESİDİV HİSSİ"
                    value={value.residu_hissi_text || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("residu_hissi_text", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="İNKONTİNANS"
                    value={value.inkontinans || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("inkontinans", v)}
                    options={["Yok", "Urge", "Stres", "Mikst", "Enürezis Nokturna"]}
                />
                <SystemQueryCombobox
                    label="EREKTİL DİSFONKSİYON"
                    value={value.erektil_islev || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("erektil_islev", v)}
                    options={["Yok", "Var", "Ara sıra"]}
                />
                <SystemQueryCombobox
                    label="EJAKÜLASYON"
                    value={value.ejakulasyon || ""}
                    disabled={readOnly}
                    onChange={(v) => updateField("ejakulasyon", v)}
                    options={["Normal", "Ağrılı", "Kanama Var", "Miktarda Azalma Var", "Miktarda Azalma Yok", "Miktarda Azalma Var-Ağrılı", "Miktarda Azalma Yok-Ağrılı"]}
                    openUpwards={true}
                />
            </div>
        </div>
    );
};
