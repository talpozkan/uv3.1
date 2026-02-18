import { z } from "zod";

export const anamnesisSchema = z.object({
    sikayet: z.string(),
    oyku: z.string(),
});

export type AnamnesisData = z.infer<typeof anamnesisSchema>;
