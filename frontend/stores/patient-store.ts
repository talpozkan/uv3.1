import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PatientSummary {
    id: string;
    ad: string;
    soyad: string;
    tc_kimlik?: string | null;
    dogum_tarihi?: string | null;
    protokol_no?: string | null;
    cinsiyet?: string | null;
}

interface PatientState {
    activePatient: PatientSummary | null;
    setActivePatient: (patient: PatientSummary | null) => void;
}

export const usePatientStore = create<PatientState>()(
    persist(
        (set) => ({
            activePatient: null,
            setActivePatient: (patient) => set({ activePatient: patient }),
        }),
        {
            name: 'patient-storage',
        }
    )
);
