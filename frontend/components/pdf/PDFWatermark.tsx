import React from 'react';
import { View, Text } from '@react-pdf/renderer';

interface PDFWatermarkProps {
    patient: {
        ad: string;
        soyad: string;
        tc_kimlik?: string | null;
    };
}

export const PDFWatermark: React.FC<PDFWatermarkProps> = ({ patient }) => {
    const maskedTc = patient.tc_kimlik ? `****${patient.tc_kimlik.substring(4)}` : "-";

    // Generate semi-random grid-based watermarks to avoid overlapping
    const watermarks = React.useMemo(() => {
        const items = [];
        const rows = 4;
        const cols = 3;
        const cellWidth = 595 / cols;
        const cellHeight = 842 / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                items.push({
                    top: (r * cellHeight) + (Math.random() * (cellHeight - 100)) + 50,
                    left: (c * cellWidth) + (Math.random() * (cellWidth - 150)),
                    rotation: -45, // Strictly parallel diagonal
                    fontSize: Math.random() > 0.5 ? 20 : 25, // Only 20 or 25 px
                    opacity: 0.06, // Clean subtle look
                });
            }
        }
        return items;
    }, []);

    return (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} fixed>
            {watermarks.map((wm, i) => (
                <View
                    key={i}
                    style={{
                        position: 'absolute',
                        top: wm.top,
                        left: wm.left,
                        opacity: wm.opacity,
                        transform: `rotate(${wm.rotation}deg)`,
                    }}
                >
                    <Text style={{ fontSize: wm.fontSize, fontWeight: 'bold', textTransform: 'uppercase', color: '#000', textAlign: 'center' }}>
                        {patient.ad} {patient.soyad}
                    </Text>
                    <Text style={{ fontSize: wm.fontSize * 0.7, fontWeight: 'bold', color: '#000', textAlign: 'center', marginTop: 2 }}>
                        {maskedTc}
                    </Text>
                </View>
            ))}
        </View>
    );
};
