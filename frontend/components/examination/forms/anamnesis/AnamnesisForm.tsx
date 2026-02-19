import React from "react";
import { AnamnesisData } from "./schema";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, FileText } from "lucide-react";

interface AnamnesisFormProps {
    value: AnamnesisData;
    onChange: (data: AnamnesisData) => void;
    readOnly?: boolean;
    storyHeaderActions?: React.ReactNode;
}

export const AnamnesisForm: React.FC<AnamnesisFormProps> = ({
    value,
    onChange,
    readOnly = false,
    storyHeaderActions
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Şikayet */}
            <div className="rounded-xl border border-white bg-white p-1 flex flex-col shadow-sm h-full">
                <div className="px-3 py-2 border-b border-slate-50 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-bold text-slate-700">Şikayet</h3>
                </div>
                <div className="p-3 flex-1">
                    <Textarea
                        value={value.sikayet}
                        disabled={readOnly}
                        onChange={(e) => onChange({ ...value, sikayet: e.target.value })}
                        className="h-full min-h-[140px] bg-slate-50 border-slate-100 resize-none font-mono text-sm leading-relaxed"
                        placeholder="Başvuru şikayeti..."
                    />
                </div>
            </div>

            {/* Öykü */}
            <div className="rounded-xl border border-white bg-white p-1 flex flex-col shadow-sm h-full">
                <div className="px-3 py-2 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-700">Öykü</h3>
                    </div>
                    {storyHeaderActions && (
                        <div className="flex items-center gap-2">
                            {storyHeaderActions}
                        </div>
                    )}
                </div>
                <div className="p-3 flex-1">
                    <Textarea
                        value={value.oyku}
                        disabled={readOnly}
                        onChange={(e) => onChange({ ...value, oyku: e.target.value })}
                        className="h-full min-h-[140px] bg-slate-50 border-slate-100 resize-none font-mono text-sm leading-relaxed"
                        placeholder="Detaylı öykü..."
                    />
                </div>
            </div>
        </div>
    );
};
