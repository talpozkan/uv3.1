/**
 * Turkish character normalization mapping
 * Converts Turkish specific characters to ASCII equivalents
 * This allows matching "Kreatinin" = "KREATİNİN" = "KREATININ"
 */
const TURKISH_CHAR_MAP: Record<string, string> = {
    'İ': 'I', 'ı': 'i',
    'Ş': 'S', 'ş': 's',
    'Ğ': 'G', 'ğ': 'g',
    'Ü': 'U', 'ü': 'u',
    'Ö': 'O', 'ö': 'o',
    'Ç': 'C', 'ç': 'c',
};

/**
 * Normalize Turkish characters to ASCII equivalents.
 * @param text - Input text with potential Turkish characters
 * @returns Text with Turkish characters replaced by ASCII equivalents
 */
export const normalizeTurkish = (text: string): string => {
    if (!text) return text;
    let result = text;
    for (const [trChar, asciiChar] of Object.entries(TURKISH_CHAR_MAP)) {
        result = result.split(trChar).join(asciiChar);
    }
    return result;
};

/**
 * Standardize test name for consistent comparison and display.
 * - Converts to lowercase
 * - Normalizes Turkish characters
 * - Strips whitespace
 * - Removes extra spaces
 * @param name - Test name to normalize
 * @returns Normalized test name
 */
export const normalizeTestName = (name: string): string => {
    if (!name) return name;
    const normalized = normalizeTurkish(name.toLowerCase().trim());
    // Remove extra whitespace
    return normalized.replace(/\s+/g, ' ');
};

/**
 * Compare two test names for equality, ignoring case and Turkish character variations
 * @param name1 - First test name
 * @param name2 - Second test name
 * @returns true if names match after normalization
 */
export const testNamesMatch = (name1: string, name2: string): boolean => {
    return normalizeTestName(name1) === normalizeTestName(name2);
};

export const isResultAbnormal = (value: string | undefined | null, reference: string | undefined | null): boolean => {
    if (!value || !reference) return false;

    // Clean strings
    const valStr = value.toString().trim().replace(',', '.');
    const refStr = reference.toString().trim().replace(',', '.');

    // Extract numeric value
    // Matches numbers like '12', '12.5', '-12.5'
    const valMatch = valStr.match(/[-+]?\d*\.?\d+/);
    if (!valMatch) return false;
    const val = parseFloat(valMatch[0]);

    try {
        // Range format: "10 - 20" or "10-20"
        if (refStr.includes('-')) {
            const parts = refStr.split('-').map(p => p.trim());
            if (parts.length === 2) {
                const lowMatch = parts[0].match(/[-+]?\d*\.?\d+/);
                const highMatch = parts[1].match(/[-+]?\d*\.?\d+/);

                if (lowMatch && highMatch) {
                    const low = parseFloat(lowMatch[0]);
                    const high = parseFloat(highMatch[0]);
                    return val < low || val > high;
                }
            }
        }

        // Inequality format: "< 5", "> 100", "<= 10"
        // Need to handle "< 5" (abnormal if >= 5) ? No, reference IS "< 5". 
        // So abnormal if val >= 5.
        // Wait, usually ref "< 5" means normal range is < 5.

        if (refStr.startsWith('<')) {
            const numMatch = refStr.match(/[-+]?\d*\.?\d+/);
            if (numMatch) {
                const limit = parseFloat(numMatch[0]);
                // If ref is "< 0.5", then 0.6 is abnormal.
                // Assuming operator in ref string defines the NORMAL set.
                if (refStr.includes('=')) {
                    return val > limit; // Normalized: <= limit is normal
                }
                return val >= limit; // < limit is normal
            }
        }

        if (refStr.startsWith('>')) {
            const numMatch = refStr.match(/[-+]?\d*\.?\d+/);
            if (numMatch) {
                const limit = parseFloat(numMatch[0]);
                if (refStr.includes('=')) {
                    return val < limit; // >= limit is normal
                }
                return val <= limit; // > limit is normal
            }
        }

    } catch (e) {
        return false;
    }

    return false;
};
