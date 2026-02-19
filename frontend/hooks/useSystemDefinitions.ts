import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export const useSystemDefinitions = (initialDoctor: string, onDoctorFound: (docName: string) => void) => {
    const [doctors, setDoctors] = useState<string[]>([]);
    const [doctorDetails, setDoctorDetails] = useState<any[]>([]);
    const [prescriptionTemplates, setPrescriptionTemplates] = useState<any[]>([]);
    const [drugList, setDrugList] = useState<any[]>([]);

    useEffect(() => {
        const fetchDefinitions = async () => {
            try {
                const setting = await api.settings.get('system_definitions');
                if (setting && setting.value) {
                    const defs = JSON.parse(setting.value);

                    // Doctors
                    if (defs && Array.isArray(defs['Doktorlar'])) {
                        const rawDocs = defs['Doktorlar'];
                        const details = rawDocs.map((d: string) => {
                            try {
                                const parsed = JSON.parse(d);
                                return typeof parsed === 'object' ? parsed : { adSoyad: parsed };
                            } catch { return { adSoyad: d }; }
                        });
                        // Store only adSoyad names in doctors array
                        const docNames = details.map((d: any) => d.adSoyad);
                        setDoctors(docNames);
                        setDoctorDetails(details);

                        // Default to current user if matches, or first doctor
                        if (initialDoctor === "" && details.length > 0) {
                            const currentUser = useAuthStore.getState().user;
                            const fullName = currentUser?.full_name;
                            const matchedDoc = details.find((d: any) => d.adSoyad.toLowerCase().includes(fullName?.toLowerCase() || ''));
                            const docToSet = matchedDoc ? matchedDoc.adSoyad : details[0].adSoyad;
                            if (docToSet) {
                                onDoctorFound(docToSet);
                            }
                        }
                    }

                    // Prescription Templates
                    if (defs && Array.isArray(defs['Reçete Şablonları'])) {
                        const rawTemps = defs['Reçete Şablonları'];
                        const templates = rawTemps.map((t: string) => {
                            try { return JSON.parse(t); } catch { return { templateName: "Bozuk Şablon", drugs: [] }; }
                        });
                        setPrescriptionTemplates(templates);
                    }

                    // Drug List Parser
                    if (defs && Array.isArray(defs['İlaç Listesi'])) {
                        const rawDrugs = defs['İlaç Listesi'];
                        const parsedDrugs = rawDrugs.map((d: string) => {
                            try { return JSON.parse(d); } catch { return { name: d }; }
                        });
                        setDrugList(parsedDrugs);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch definitions", e);
                // Fallback: drugs_seed.json if API fails
                try {
                    const response = await fetch('/drugs_seed.json');
                    if (response.ok) {
                        const seedData = await response.json();
                        setDrugList(seedData);
                        toast.error("Sunucu hatası: Sistem tanımları alınamadı, yerel ilaç listesi kullanılıyor.");
                    }
                } catch (fbError) {
                    console.error("Fallback failed", fbError);
                }
            }
        };

        // Guard to prevent duplicate fetches
        let fetched = false;

        // Wait for auth store hydration before fetching
        const unsubscribe = useAuthStore.subscribe((state) => {
            if (state._hasHydrated && state.token && !fetched) {
                fetched = true;
                fetchDefinitions();
                unsubscribe();
            }
        });

        // Check if already hydrated
        const currentState = useAuthStore.getState();
        if (currentState._hasHydrated && currentState.token && !fetched) {
            fetched = true;
            fetchDefinitions();
            unsubscribe();
        }

        return () => unsubscribe();
    }, []); // Empty dependency array - fetch once on mount only

    const savePrescriptionTemplate = async (name: string, drugs: any[]) => {
        try {
            const setting = await api.settings.get('system_definitions');
            let defs: any = {};
            if (setting && setting.value) {
                defs = JSON.parse(setting.value);
            }

            const currentTemplates = defs['Reçete Şablonları'] || [];

            const newTemplateData = {
                id: crypto.randomUUID(),
                templateName: name,
                drugs: drugs
            };

            const newTemplateString = JSON.stringify(newTemplateData);
            const updatedTemplates = [...currentTemplates, newTemplateString];

            defs['Reçete Şablonları'] = updatedTemplates;

            await api.settings.update({ key: 'system_definitions', value: JSON.stringify(defs) });

            // Update local state
            setPrescriptionTemplates(prev => [...prev, newTemplateData]);

            toast.success("Şablon başarıyla kaydedildi.");

        } catch (e) {
            console.error(e);
            toast.error("Şablon kaydedilirken hata oluştu.");
        }
    };

    return {
        doctors,
        doctorDetails,
        prescriptionTemplates,
        drugList,
        savePrescriptionTemplate
    };
};
