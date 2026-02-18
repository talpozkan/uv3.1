import { z } from "zod";

export const habitsSchema = z.object({
    sigara: z.string(),
    alkol: z.string(),
});

export type HabitsData = z.infer<typeof habitsSchema>;
