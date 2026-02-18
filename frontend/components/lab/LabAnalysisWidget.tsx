"use client";

import { LabTrendSparkline } from "./LabTrendSparkline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface LabAnalysisWidgetProps {
    patientId: string;
}

export function LabAnalysisWidget({ patientId }: LabAnalysisWidgetProps) {
    // Default tests to show
    const tests = [
        { name: "PSA (Total)", label: "PSA (Total)", color: "#8b5cf6" }, // Purple
        { name: "PSA (Serbest)", label: "PSA (Serbest)", color: "#a78bfa" }, // Light Purple
        { name: "Testosteron (Total)", label: "Test. (Total)", color: "#3b82f6" }, // Blue
        { name: "Testosteron (Serbest)", label: "Test. (Serbest)", color: "#60a5fa" }, // Light Blue
        { name: "Kreatinin", label: "Kreatinin", color: "#10b981" }, // Emerald
        { name: "Üre", label: "Üre", color: "#f59e0b" }, // Amber
    ];

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center">
                    <Activity className="mr-2 h-5 w-5 text-primary" />
                    Kritik Laboratuvar Trendleri
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {tests.map((test) => (
                        <LabTrendSparkline
                            key={test.name}
                            patientId={patientId}
                            testName={test.name}
                            label={test.label}
                            color={test.color}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
