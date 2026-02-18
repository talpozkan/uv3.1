import React from 'react';

interface PrintWatermarkProps {
    patientName: string;
    patientTc?: string;
}

export const PrintWatermark: React.FC<PrintWatermarkProps> = ({ patientName, patientTc }) => {
    // Generate grid-based watermarks to avoid overlapping matching PDF style
    const watermarks = React.useMemo(() => {
        const items = [];
        const rows = 4;
        const cols = 3;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                items.push({
                    top: (r * 25) + 5 + (Math.random() * 10), // % based height approximately
                    left: (c * 33) + (Math.random() * 10), // % based width
                    rotation: -45,
                    fontSize: Math.random() > 0.5 ? '20px' : '25px',
                });
            }
        }
        return items;
    }, []);

    return (
        <div className="hidden print:block fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.06]">
            {watermarks.map((wm, i) => (
                <div
                    key={i}
                    className="absolute whitespace-nowrap text-slate-950 uppercase text-center font-bold"
                    style={{
                        top: `${wm.top}%`,
                        left: `${wm.left}%`,
                        fontSize: wm.fontSize,
                        transform: `rotate(${wm.rotation}deg)`,
                    }}
                >
                    <div>{patientName}</div>
                    <div style={{ fontSize: '0.7em', marginTop: '2px' }}>{patientTc || '-'}</div>
                </div>
            ))}
        </div>
    );
};
