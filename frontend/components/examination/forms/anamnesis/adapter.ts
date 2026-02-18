import { AnamnesisData } from "./schema";
import { ExaminationFormData } from "@/hooks/useExaminationPageLogic";

export const anamnesisAdapter = {
    toNew: (formData: ExaminationFormData): AnamnesisData => ({
        sikayet: formData.sikayet || "",
        oyku: formData.oyku || "",
    }),
    toLegacy: (data: AnamnesisData): Partial<ExaminationFormData> => ({
        sikayet: data.sikayet,
        oyku: data.oyku,
    })
};
