"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, LabDataPoint, LabTrendResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Loader2, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

interface LabTrendSparklineProps {
    patientId: string;
    testName: string;
    label?: string;
    color?: string;
    className?: string;
}

export function LabTrendSparkline({
    patientId,
    testName,
    label,
    color = "#8884d8", // Default purple-ish
    className
}: LabTrendSparklineProps) {
    const [data, setData] = useState<LabTrendResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchData() {
            setLoading(true);
            try {
                const response = await api.labAnalysis.getTrends({
                    patient_id: patientId,
                    test_names: [testName]
                });

                if (isMounted) {
                    if (response && response.length > 0) {
                        setData(response[0]);
                    } else {
                        setData(null); // No data found
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setError("Veri alınamadı");
                    console.error(err);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        if (patientId && testName) {
            fetchData();
        }

        return () => {
            isMounted = false;
        };
    }, [patientId, testName]);

    if (loading) {
        return (
            <Card className={cn("w-full h-[120px] flex items-center justify-center", className)}>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </Card>
        );
    }

    if (error || !data || data.history.length === 0) {
        return (
            <Card className={cn("w-full h-[120px] flex items-center justify-center text-sm text-muted-foreground", className)}>
                Veri Yok
            </Card>
        );
    }

    const isPositiveTrend = data.trend_slope > 0;
    const isCritical = data.is_critical;

    // Format date for tooltip
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('tr-TR');
    };

    return (
        <Card className={cn("w-full overflow-hidden", className)}>
            <div className="p-4 pb-0 flex justify-between items-start">
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                        {label || data.test_name}
                    </h3>
                    <div className="flex items-baseline space-x-2 mt-1">
                        <span className={cn(
                            "text-2xl font-bold",
                            isCritical ? "text-red-600" : "text-foreground"
                        )}>
                            {data.current_value}
                        </span>
                        <span className="text-sm text-muted-foreground">{data.unit}</span>
                    </div>
                </div>

                {data.history.length > 1 && (
                    <div className={cn(
                        "flex items-center text-xs px-2 py-1 rounded-full",
                        isCritical ? "bg-red-100 text-red-700" : (isPositiveTrend ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")
                        // Note: For PSA, positive trend is usually bad (red), negative is good (green).
                        // Logic might need customization per test type, but assuming Rising = Red for generic lab warning context if we naively assume rising is bad?
                        // Actually, rising Hemoglobin is good if low. 
                        // For PSA, rising is bad.
                        // Let's stick to trend direction visuals: Up arrow, Down arrow.
                        // And use color only if 'is_critical' is true, or neutral otherwise.
                    )}>
                        {isCritical && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {isPositiveTrend ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}

                        {Math.abs(data.trend_slope).toFixed(2)}/gün
                    </div>
                )}
            </div>

            <div className="h-[60px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.history}>
                        <defs>
                            <linearGradient id={`color-${testName}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={isCritical ? "#ef4444" : color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={isCritical ? "#ef4444" : color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-popover border border-border p-2 rounded shadow-sm text-xs">
                                            <p className="font-semibold">{formatDate(payload[0].payload.date)}</p>
                                            <p>{payload[0].value} {data.unit}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={isCritical ? "#ef4444" : color}
                            fillOpacity={1}
                            fill={`url(#color-${testName})`}
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
