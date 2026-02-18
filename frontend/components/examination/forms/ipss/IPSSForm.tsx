import React, { useMemo } from 'react';
import { IPSSData } from './schema';
import { IPSS_LABELS, IPSS_OPTIONS, QOL_OPTIONS } from './constants';
import { cn } from '@/lib/utils';
import { Ops } from '../../shared/types';
import { Label } from '@/components/ui/label';

/* 
 * Re-creating the sub-component locally to keep this file self-contained 
 * or we could put it in shared if used by others. 
 * For now, IPSSQuestion is specific to this layout.
 */
const IPSSQuestionRow = React.memo(({
    label,
    description,
    value,
    onChange,
    disabled,
    options
}: {
    label: string,
    description: string,
    value: string,
    onChange: (v: string) => void,
    disabled?: boolean,
    options: readonly string[]
}) => (
    <div className={cn(
        "flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors px-2 rounded-lg -mx-2",
        disabled && "opacity-60 pointer-events-none"
    )}>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
            <Label className="text-xs font-bold text-slate-700 uppercase">{label}</Label>
            <span className="text-[11px] text-slate-500 font-medium leading-tight">{description}</span>
        </div>
        <div className="flex items-center bg-slate-100 p-1 rounded-lg shrink-0 gap-0.5">
            {options.map((opt) => (
                <button
                    key={opt}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt)}
                    className={cn(
                        "w-10 h-10 md:w-8 md:h-8 rounded-md text-xs font-bold transition-all", // Increased touch target for mobile
                        value === opt
                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5 scale-105 z-10"
                            : "text-slate-400 hover:bg-white/50 hover:text-slate-600"
                    )}
                    aria-label={`${label} - Puan: ${opt}`}
                    aria-pressed={value === opt}
                >
                    {opt}
                </button>
            ))}
        </div>
    </div>
));
IPSSQuestionRow.displayName = "IPSSQuestionRow";

export const IPSSForm = React.memo(({
    value,
    onChange,
    readOnly,
    isLoading
}: Ops<IPSSData>) => {

    const handleChange = (field: keyof IPSSData) => (val: string) => {
        onChange({
            ...value,
            [field]: val
        });
    };

    const questions = useMemo(() => [
        { id: 'ipss1', ...IPSS_LABELS.questions.ipss1 },
        { id: 'ipss2', ...IPSS_LABELS.questions.ipss2 },
        { id: 'ipss3', ...IPSS_LABELS.questions.ipss3 },
        { id: 'ipss4', ...IPSS_LABELS.questions.ipss4 },
        { id: 'ipss5', ...IPSS_LABELS.questions.ipss5 },
        { id: 'ipss6', ...IPSS_LABELS.questions.ipss6 },
        { id: 'ipss7', ...IPSS_LABELS.questions.ipss7 },
    ] as const, []);

    return (
        <div className={cn("space-y-4", isLoading && "opacity-50 pointer-events-none animate-pulse")}>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        {IPSS_LABELS.title}
                    </h3>
                    {value.ipss_total && (
                        <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-100">
                            Toplam: {value.ipss_total}
                        </span>
                    )}
                </div>

                <div className="space-y-1">
                    {questions.map((q) => (
                        <IPSSQuestionRow
                            key={q.id}
                            label={q.label}
                            description={q.description}
                            value={value[q.id as keyof IPSSData] || ''}
                            onChange={handleChange(q.id as keyof IPSSData)}
                            disabled={readOnly}
                            options={IPSS_OPTIONS}
                        />
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                    <IPSSQuestionRow
                        label={IPSS_LABELS.qualityOfLife.label}
                        description={IPSS_LABELS.qualityOfLife.description}
                        value={value.ipss_qol || ''}
                        onChange={handleChange('ipss_qol')}
                        disabled={readOnly}
                        options={QOL_OPTIONS}
                    />
                </div>
            </div>
        </div>
    );
});
IPSSForm.displayName = "IPSSForm";
