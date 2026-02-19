import { Font } from '@react-pdf/renderer';

/**
 * Registers Roboto font with @react-pdf/renderer once.
 * Ensures Turkish characters are properly supported in PDF exports.
 */
export const registerPDFFonts = () => {
    // Only register once
    try {
        Font.register({
            family: 'Roboto',
            fonts: [
                { src: '/fonts/Roboto-Regular.ttf', fontWeight: 'normal' },
                { src: '/fonts/Roboto-Bold.ttf', fontWeight: 'bold' },
                { src: '/fonts/Roboto-Italic.ttf', fontWeight: 'normal', fontStyle: 'italic' },
                { src: '/fonts/Roboto-BoldItalic.ttf', fontWeight: 'bold', fontStyle: 'italic' },
            ],
        });
        console.log("PDF Fonts (Roboto) registered successfully.");
    } catch (error) {
        console.error("PDF Font registration failed:", error);
    }
};

/**
 * Turkish-aware uppercase transformation.
 * Standard toUpperCase() fails with 'i' -> 'İ' and 'I' -> 'I' logic in non-Turkish locales.
 */
export const trUpper = (text: string | null | undefined): string => {
    if (!text) return "";

    return text
        .replace(/i/g, "İ")
        .replace(/ı/g, "I")
        .toUpperCase();
};
