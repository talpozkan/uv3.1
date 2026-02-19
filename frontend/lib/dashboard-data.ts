import { DashboardData } from '@/types/dashboard';

export const MOCK_DASHBOARD_DATA: DashboardData = {
    summary: {
        totalPatients: {
            value: 1248,
            growth: 12,
            trend: 'up',
        },
        occupancy: {
            rate: 85,
            filled: 18,
            total: 21,
            breakdown: {
                examination: 12,
                control: 6,
            },
        },
        pendingLabs: {
            count: 5,
            urgent: 2,
        },
        statistics: {
            today_new_patients: 3,
            today_appointments: 8,
            week_new_patients: 12,
            week_appointments: 42,
            month_new_patients: 48,
            month_appointments: 156,
            last_month_new_patients: 45,
            last_month_appointments: 148,
        },
    },
    heatmap: [
        // 09:00
        { day: 'Pzt', hour: '09:00', value: 6, intensity: 'medium' },
        { day: 'Sal', hour: '09:00', value: 8, intensity: 'high' },
        { day: 'Çar', hour: '09:00', value: 4, intensity: 'low' },
        { day: 'Per', hour: '09:00', value: 6, intensity: 'medium' },
        { day: 'Cum', hour: '09:00', value: 4, intensity: 'low' },

        // 10:00
        { day: 'Pzt', hour: '10:00', value: 8, intensity: 'high' },
        { day: 'Sal', hour: '10:00', value: 5, intensity: 'medium' },
        { day: 'Çar', hour: '10:00', value: 6, intensity: 'high' },
        { day: 'Per', hour: '10:00', value: 3, intensity: 'low' },
        { day: 'Cum', hour: '10:00', value: 2, intensity: 'low' },
    ],
    recentActivity: [
        {
            id: '1',
            patientName: 'Ahmet Yılmaz',
            protocolNo: '#2025-001',
            procedure: 'Rutin Kontrol (BPH)',
            doctor: 'Dr. Alp',
            time: '09:30',
            status: 'completed',
        },
        {
            id: '2',
            patientName: 'Mehmet Demir',
            protocolNo: '#2025-002',
            procedure: 'Sistoskopi',
            doctor: 'Dr. Alp',
            time: '10:15',
            status: 'in-progress',
        },
        {
            id: '3',
            patientName: 'Ayşe Kaya',
            protocolNo: '#2025-003',
            procedure: 'USG Kontrol',
            doctor: 'Dr. Zeynep',
            time: '11:00',
            status: 'waiting',
        },
        {
            id: '4',
            patientName: 'Mustafa Çelik',
            protocolNo: '#2025-004',
            procedure: 'PSA Test Sonucu',
            doctor: 'Dr. Alp',
            time: '11:30',
            status: 'waiting',
        },
    ],
};
