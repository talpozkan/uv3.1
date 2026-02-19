import { HabitsData } from "./schema";

export const habitsAdapter = {
    toNew: (formData: any): HabitsData => ({
        sigara: formData.sigara || "",
        alkol: formData.alkol || "",
    }),
    toLegacy: (data: HabitsData): any => ({
        sigara: data.sigara,
        alkol: data.alkol,
    })
};
