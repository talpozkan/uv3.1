export const IPSS_LABELS = {
    title: "IPSS",
    description: "Uluslararası Prostat Semptom Skoru",
    questions: {
        ipss1: { label: "1. Yetersiz Boşalma", description: "İdrar yaptıktan sonra mesanenin tam boşalmadığı hissi" },
        ipss2: { label: "2. Sık İdrara Çıkma", description: "İdrar yaptıktan sonra 2 saat içinde tekrar idrara çıkma" },
        ipss3: { label: "3. Kesik Kesik İşeme", description: "İdrar yaparken durup yeniden başlama" },
        ipss4: { label: "4. Tutamama", description: "İdrarı tutmakta zorlanma" },
        ipss5: { label: "5. Zayıf Akım", description: "İdrar akımının zayıf olması" },
        ipss6: { label: "6. Ikınma", description: "İdrara başlamak için ıkınma zorunluluğu" },
        ipss7: { label: "7. Gece İdrara Çıkma", description: "Gece uykudan uyanıp idrara kalkma sayısı" }
    },
    qualityOfLife: {
        label: "Yaşam Kalitesi",
        description: "Mevcut idrar durumuyla yaşamınızı nasıl geçirirsiniz?"
    }
} as const;

export const IPSS_OPTIONS = ['0', '1', '2', '3', '4', '5'];
export const QOL_OPTIONS = ['0', '1', '2', '3', '4', '5', '6'];
