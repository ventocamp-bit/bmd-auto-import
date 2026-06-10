import { GoogleGenAI, Type, Schema } from '@google/genai';
export interface CocData {
    FIN: string;
    Aussteller: string;
    Marke: string;
    Typ: string;
    [key: string]: string;
}

export interface CocExtractionResult {
    data: CocData;
    confidences: Record<string, number>;
    raw: unknown;
    ocrText: string;
    promptVersion: string;
    calculatedFields: string[];
}

export const COC_EXTRACTION_PROMPT_VERSION = '2026-06-10-bmd-csv-v11-clean-german';

export const GDB_FIELD_KEYS = [
    'FIN',
    'AUSST_GENDOK',
    'MARKE',
    'TYPE',
    'VAR',
    'VERS',
    'HANDNAME',
    'TGNR',
    'REVISION_GEN',
    'DAT_GENDOK',
    'RADST_1',
    'RADST_2',
    'RADST_3',
    'RADST_4',
    'LAENGE',
    'BREITE',
    'HOEHE',
    'ABST_ANHVORR',
    'LADEFL_LAENGE',
    'UEBERH_HINTEN',
    'MASSE_FAHRB',
    'VERT_ACHSE_1',
    'VERT_ACHSE_2',
    'VERT_ACHSE_3',
    'VERT_ACHSE_4',
    'VERT_STUETZ',
    'TATS_FAHRZEUGMASSE',
    'HZUL_NUTZLAST',
    'HZUL_MINDEST',
    'TECH_ZUL_MASSE',
    'TECH_ZUL_ACHSL_1',
    'TECH_ZUL_ACHSL_2',
    'TECH_ZUL_ACHSL_3',
    'TECH_ZUL_ACHSL_4',
    'TECH_ZUL_ACHSGR_1',
    'TECH_ZUL_ACHSGR_2',
    'TECH_ZUL_STUETZ',
    'VMAX_GEM',
    'SPURW_1',
    'SPURW_2',
    'SPURW_3',
    'RADREIFEN_ACHSE1',
    'RADREIFEN_ACHSE2',
    'RADREIFEN_ACHSE3',
    'BER_ACHS4',
    'AUFBAU_EU_C',
    'AUFBAU_NAT_C',
    'ANHVORR_GENZ',
    'KENNW_ANHAENGEVORR',
    'FARBE_C',
    'KUNDENNr',
    'TypSMail',
] as const;

type FieldName = string;



const FIELD_DEFINITIONS: Record<string, string> = {
    FIN: 'COC 0.10 Fahrzeugidentifikationsnummer / VIN',
    AUSST_GENDOK: 'Unterzeichner der Uebereinstimmungsbescheinigung, meist bei Unterschrift/Stempel',
    MARKE: 'COC 0.1 Fabrikmarke / Hersteller',
    TYPE: 'COC 0.2 Typ',
    VAR: 'COC 0.2 Variante',
    VERS: 'COC 0.2 Version',
    HANDNAME: 'COC 0.2.1 Handelsname',
    TGNR: 'Typgenehmigungsnummer einschliesslich Erweiterungsnummer, z.B. e9*2007/46*0445*08',
    REVISION_GEN: 'Revision der Genehmigung, nur wenn eindeutig angegeben',
    DAT_GENDOK: 'Ausstellungsdatum der Uebereinstimmungsbescheinigung',
    RADST_1: 'COC 4 Radstand in mm',
    RADST_2: 'COC 4.1 Achsabstand 1-2 in mm, leer bei nicht anwendbar',
    RADST_3: 'COC 4.1 Achsabstand 2-3 in mm, leer bei nicht anwendbar',
    RADST_4: 'COC 4.1 Achsabstand 3-4 in mm, leer bei nicht anwendbar',
    LAENGE: 'COC 5 Laenge in mm',
    BREITE: 'COC 6 Breite in mm',
    HOEHE: 'COC 7 Hoehe in mm',
    ABST_ANHVORR: 'COC 10 Abstand zwischen Anhaengevorrichtung und Fahrzeugheck in mm',
    LADEFL_LAENGE: 'COC 11 Laenge der Ladeflaeche in mm',
    UEBERH_HINTEN: 'COC 12 Hinterer Ueberhang in mm',
    MASSE_FAHRB: 'COC 13 Masse des fahrbereiten Fahrzeugs in kg',
    VERT_ACHSE_1: 'COC 13.1 Verteilung der Masse auf Achse 1 in kg',
    VERT_ACHSE_2: 'COC 13.1 Verteilung der Masse auf Achse 2 in kg, leer bei nicht anwendbar',
    VERT_ACHSE_3: 'COC 13.1 Verteilung der Masse auf Achse 3 in kg, leer bei nicht anwendbar',
    VERT_ACHSE_4: 'COC 13.1 Verteilung der Masse auf Achse 4 in kg, leer bei nicht anwendbar',
    VERT_STUETZ: 'COC 13.1 Verteilung der Masse auf die Stuetzlast in kg',
    TATS_FAHRZEUGMASSE: 'COC 13.2 Tatsaechliche Masse des Fahrzeugs in kg',
    HZUL_NUTZLAST: 'nicht am COC, nur ausfuellen wenn explizit angegeben',
    HZUL_MINDEST: 'nicht am COC, hoechstzulaessiges Gesamtgewicht Mindestwert in kg, wenn vorhanden',
    TECH_ZUL_MASSE: 'COC 16.1 Technisch zulaessige Gesamtmasse in beladenem Zustand in kg',
    TECH_ZUL_ACHSL_1: 'COC 16.2 Technisch zulaessige maximale Masse Achse 1 in kg',
    TECH_ZUL_ACHSL_2: 'COC 16.2 Technisch zulaessige maximale Masse Achse 2 in kg, leer bei nicht anwendbar',
    TECH_ZUL_ACHSL_3: 'COC 16.2 Technisch zulaessige maximale Masse Achse 3 in kg, leer bei nicht anwendbar',
    TECH_ZUL_ACHSL_4: 'COC 16.2 Technisch zulaessige maximale Masse Achse 4 in kg, leer bei nicht anwendbar',
    TECH_ZUL_ACHSGR_1: 'COC 16.3 Technisch zulaessige maximale Masse Achsgruppe 1 in kg',
    TECH_ZUL_ACHSGR_2: 'COC 16.3 Technisch zulaessige maximale Masse Achsgruppe 2 in kg, leer bei nicht anwendbar',
    TECH_ZUL_STUETZ: 'COC 19 Technisch zulaessige Stuetzlast am Kupplungspunkt in kg',
    VMAX_GEM: 'COC 29 Hoechstgeschwindigkeit in km/h',
    SPURW_1: 'COC 30.1/30.2 Spurweite 1. Achse in mm',
    SPURW_2: 'COC 30.1/30.2 Spurweite 2. Achse in mm, leer bei nicht anwendbar',
    SPURW_3: 'COC 30.1/30.2 Spurweite 3. Achse in mm, leer bei nicht anwendbar',
    RADREIFEN_ACHSE1: 'COC 35.1 Reifen-/Radkombination Achse 1',
    RADREIFEN_ACHSE2: 'COC 35.2 Reifen-/Radkombination Achse 2, leer bei nicht anwendbar',
    RADREIFEN_ACHSE3: 'COC 35.3 Reifen-/Radkombination Achse 3, leer bei nicht anwendbar',
    BER_ACHS4: 'COC 35.4 Reifen-/Radkombination Achse 4, leer bei nicht anwendbar',
    AUFBAU_EU_C: 'COC 38 Code des Aufbaus, 1. Teil Buchstaben',
    AUFBAU_NAT_C: 'COC 38 Code des Aufbaus, 2. Teil Ziffern',
    ANHVORR_GENZ: 'COC 44 Genehmigungsnummer oder -zeichen der Anhaengevorrichtung, z.B. E1 55R-012671',
    KENNW_ANHAENGEVORR: 'COC 45.1 Kennwerte der Anhaengevorrichtung, z.B. D:, V:, S:, U:. Nicht mit COC 44 vertauschen. Leere Platzhalter wie V: ... oder U: ... weglassen.',
    FARBE_C: 'Farbe des Fahrzeugs, wenn angegeben',
    KUNDENNr: 'Kundennummer bei WVTA, nicht aus dem COC raten',
    TypSMail: 'E-Mail fuer Einmeldebestaetigung, nicht aus dem COC raten',
};

const SCHEMA_EXAMPLE = GDB_FIELD_KEYS.reduce((result, key) => {
    result[key] = { value: '', confidence: 0 };
    return result;
}, {} as Record<string, { value: string; confidence: number }>);

const FIELD_RESULT_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        _OCR_TEXT: {
            type: Type.STRING,
            description: 'Visible OCR text from the document, preserving COC point numbers and relevant table rows for audit and deterministic post-processing.',
        },
        ...GDB_FIELD_KEYS.reduce((result, key) => {
            result[key] = {
                type: Type.OBJECT,
                properties: {
                    value: {
                        type: Type.STRING,
                        description: FIELD_DEFINITIONS[key],
                    },
                    confidence: {
                        type: Type.NUMBER,
                        description: '0 to 1 confidence score for this exact extracted value.',
                    },
                },
                required: ['value', 'confidence'],
            };
            return result;
        }, {} as Record<string, Schema>),
    },
    required: ['_OCR_TEXT', ...GDB_FIELD_KEYS],
};

const EXTRACTION_SYSTEM_INSTRUCTION = `
You are a deterministic COC-to-BMD extraction engine.
Return only data that is visible in the supplied document.
The target output fills a BMD import CSV generated from an XLSX template.
The CSV/template has one row per GDB key in column A ("Feld GDB"); the extracted value is written into column D of that exact row.
Use exactly the response schema. Do not add, omit, rename, or reorder business keys.
For numeric mm/kg/km/h fields, return only the number without unit.
Return empty string with confidence 0 for values that are not present, N/A, not applicable, or unreadable.
Preserve names, manufacturer spelling, diacritics, approval numbers, tyre strings, and email addresses exactly.
Translate explanatory labels to German when labels are unavoidable, but field values must not contain Polish, English, or German label text.
FIN must be a 17-character vehicle identification number when visible.
Do not infer KUNDENNr or TypSMail from unrelated contact data.
Do not swap COC 44 and 45.1: ANHVORR_GENZ is only the E/approval number(s), without labels; KENNW_ANHAENGEVORR contains only real D/V/S/U characteristic values. Omit empty placeholders like V: ... and U: ....
`;

const FEW_SHOT_EXAMPLES = `
Manufacturer layout examples:

TOMPLAN example:
- Visible COC 4.1 table: "Axle spacing: 0-1 3198 mm / 1-2 700 mm / 2-3 N/A"
- Correct mapping: RADST_2 = "700", RADST_3 = "", never put the 0-1 value into RADST_2.
- Visible tyre line: "axle 1 195/50R13C 6x13 ... axle 2 195/50R13C 6x13"
- Correct mapping: RADREIFEN_ACHSE1 = "195/50R13C 6x13", RADREIFEN_ACHSE2 = "195/50R13C 6x13".
- Visible COC 45.1: "Drawbar: D=25,87 kN, S=300kg / Overrunning device: D=25 kN, S=150 kg / Coupling head: D=25 kN, S=250 kg"
- Correct mapping: KENNW_ANHAENGEVORR contains all three characteristic lines.

NIEWIADOW-style example:
- If COC 4.1 says only one applicable axle spacing and later rows are N/A, fill only the applicable GDB row and leave non-applicable axle rows empty.
- If COC 35 tyre/wheel data contains both tyre and rim, preserve both in the same value.
`;

const NUMERIC_FIELDS = new Set([
    'RADST_1',
    'RADST_2',
    'RADST_3',
    'RADST_4',
    'LAENGE',
    'BREITE',
    'HOEHE',
    'ABST_ANHVORR',
    'LADEFL_LAENGE',
    'UEBERH_HINTEN',
    'MASSE_FAHRB',
    'VERT_ACHSE_1',
    'VERT_ACHSE_2',
    'VERT_ACHSE_3',
    'VERT_ACHSE_4',
    'VERT_STUETZ',
    'TATS_FAHRZEUGMASSE',
    'HZUL_NUTZLAST',
    'HZUL_MINDEST',
    'TECH_ZUL_MASSE',
    'TECH_ZUL_ACHSL_1',
    'TECH_ZUL_ACHSL_2',
    'TECH_ZUL_ACHSL_3',
    'TECH_ZUL_ACHSL_4',
    'TECH_ZUL_ACHSGR_1',
    'TECH_ZUL_ACHSGR_2',
    'TECH_ZUL_STUETZ',
    'VMAX_GEM',
    'SPURW_1',
    'SPURW_2',
    'SPURW_3',
]);

function normalizeValue(value: string, key: FieldName) {
    const trimmed = value.trim();
    if (/^(--|-|n\/?a|not applicable|not present|nicht zutreffend|leer)$/i.test(trimmed)) {
        return '';
    }

    if (key === 'KENNW_ANHAENGEVORR') {
        return cleanHitchCharacteristicValue(trimmed);
    }

    if (key === 'TYPE' || key === 'VAR' || key === 'VERS') {
        return trimmed
            .replace(/[Т]/g, 'T')
            .replace(/[А]/g, 'A')
            .replace(/[В]/g, 'B')
            .replace(/[С]/g, 'C')
            .replace(/[Е]/g, 'E')
            .replace(/[Н]/g, 'H')
            .replace(/[К]/g, 'K')
            .replace(/[М]/g, 'M')
            .replace(/[О]/g, 'O')
            .replace(/[Р]/g, 'P')
            .replace(/[Х]/g, 'X')
            .trim();
    }

    if (NUMERIC_FIELDS.has(key)) {
        return trimmed
            .replace(/\s*(mm|kg|km\/h|kph)\b/gi, '')
            .replace(',', '.')
            .trim();
    }

    return trimmed;
}

function cleanHitchCharacteristicValue(value: string) {
    const compact = value
        .replace(/\b(Characteristics values|Kennwerte der Anhaengevorrichtung|Kennwerte der Anhängvorrichtung|Kennwerte der Anhängevorrichtung|Wartości charakterystyczne)\b[^:;]*:\s*/gi, '')
        .replace(/---+/g, '...')
        .replace(/\s+/g, ' ')
        .trim();
    const parts: string[] = [];
    const normalized = compact.replace(/\s*\/\s*/g, '; ');

    for (const match of normalized.matchAll(/\b([DVSU])\s*[=:]\s*([^;]+)/gi)) {
        const label = match[1].toUpperCase();
        const raw = match[2].trim().replace(/^[:;\s]+|[:;\s]+$/g, '');
        if (!raw || /\.{2,}/.test(raw) || !/\d/.test(raw)) {
            continue;
        }

        parts.push(`${label}: ${raw}`);
    }

    return parts.length > 0 ? parts.join('; ') : compact.replace(/^[:;\s]+/, '');
}

function isTransientGeminiError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('503')
        || message.includes('429')
        || message.includes('UNAVAILABLE')
        || message.includes('RESOURCE_EXHAUSTED')
        || message.toLowerCase().includes('high demand')
        || message.toLowerCase().includes('quota')
        || message.toLowerCase().includes('timeout');
}

function isQuotaGeminiError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('429')
        || message.includes('RESOURCE_EXHAUSTED')
        || message.toLowerCase().includes('quota');
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeField(raw: any, key: FieldName): { value: string; confidence: number } {
    const field = raw?.[key];

    if (typeof field === 'string') {
        return { value: normalizeValue(field, key), confidence: 0.75 };
    }

    if (field && typeof field === 'object') {
        const value = typeof field.value === 'string' ? normalizeValue(field.value, key) : '';
        const confidence = typeof field.confidence === 'number' ? Math.max(0, Math.min(1, field.confidence)) : 0.5;
        return { value, confidence };
    }

    return { value: '', confidence: 0 };
}

function validateStructuredExtraction(parsed: any) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Gemini structured response is not an object.');
    }

    const missingKeys = GDB_FIELD_KEYS.filter((key) => !(key in parsed));
    if (missingKeys.length > 0) {
        throw new Error(`Gemini structured response is missing keys: ${missingKeys.join(', ')}`);
    }

    const invalidKeys = GDB_FIELD_KEYS.filter((key) => {
        const field = parsed[key];
        return !field
            || typeof field !== 'object'
            || typeof field.value !== 'string'
            || typeof field.confidence !== 'number'
            || field.confidence < 0
            || field.confidence > 1;
    });

    if (invalidKeys.length > 0) {
        throw new Error(`Gemini structured response has invalid fields: ${invalidKeys.join(', ')}`);
    }
}

function firstMatch(text: string, pattern: RegExp) {
    const match = text.match(pattern);
    return match?.[1]?.trim() || '';
}

function normalizeDate(value: string) {
    const match = value.match(/^(\d{1,2})[./-](\d{1,2})[./\-\s]+(\d{4})$/);
    if (!match) {
        return value.trim();
    }

    return `${match[1].padStart(2, '0')}.${match[2].padStart(2, '0')}.${match[3]}`;
}

function normalizeLines(text: string) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function numericValue(value: string, key: FieldName) {
    return normalizeValue(value, key);
}

function isNotApplicable(value: string) {
    return /^(n\/?a|not applicable|nicht zutreffend|-|--)?$/i.test(value.trim());
}

function extractWheelbase(lines: string[]) {
    const wheelbaseIndex = lines.findIndex((line) => /^(Wheelbase|Radstand)\s*:?\s*$/i.test(line));
    if (wheelbaseIndex < 0) {
        return '';
    }

    const nextLabelIndex = lines.findIndex((line, index) => index > wheelbaseIndex && /^(0-1|1-2|2-3|5\.|Length|Laenge|Länge)\b/i.test(line));
    const searchLines = lines.slice(wheelbaseIndex + 1, nextLabelIndex > -1 ? nextLabelIndex : wheelbaseIndex + 8);
    const valueLine = searchLines.find((line) => /\b\d{3,6}\s*mm\b/i.test(line));
    return valueLine ? numericValue(valueLine, 'RADST_1') : '';
}

function extractNumberFromLine(line: string, key: FieldName) {
    if (isNotApplicable(line)) {
        return '';
    }

    const match = line.match(/([0-9][0-9\s.,]*)\s*(?:mm|kg|km\/h)?\b/i);
    return match ? numericValue(match[1], key) : '';
}

function parseNumericField(value: string) {
    const normalized = normalizeValue(value || '', 'TECH_ZUL_MASSE').replace(/\s+/g, '');
    if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
        return null;
    }

    return Number(normalized);
}

function formatDerivedNumber(value: number) {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function extractAxleSpacingByLabels(lines: string[], ocrText: string) {
    const compact = ocrText.replace(/\s+/g, ' ');
    const inlineBlock = compact.match(/4\.1\.\s*Axle spacing:\s*(.+?)(?=\s*5\.\s*Length|\s*6\.\s*Width|\s*Masses\b)/i)?.[1] || '';
    if (inlineBlock) {
        const zeroOne = inlineBlock.match(/\b0-1\s+([0-9][0-9\s.,]*|N\/A|not applicable)\s*(?:mm)?/i)?.[1] || '';
        const oneTwo = inlineBlock.match(/\b1-2\s+([0-9][0-9\s.,]*|N\/A|not applicable)\s*(?:mm)?/i)?.[1] || '';
        const twoThree = inlineBlock.match(/\b2-3\s+([0-9][0-9\s.,]*|N\/A|not applicable)\s*(?:mm)?/i)?.[1] || '';

        return {
            zeroOne: extractNumberFromLine(zeroOne, 'RADST_2'),
            oneTwo: extractNumberFromLine(oneTwo, 'RADST_2'),
            twoThree: extractNumberFromLine(twoThree, 'RADST_3'),
        };
    }

    const zeroOneIndex = lines.findIndex((line, index) => (
        /^0-1$/i.test(line)
        && /^1-2$/i.test(lines[index + 1] || '')
        && /^2-3$/i.test(lines[index + 2] || '')
    ));

    if (zeroOneIndex < 0) {
        return null;
    }

    return {
        zeroOne: extractNumberFromLine(lines[zeroOneIndex + 3] || '', 'RADST_2'),
        oneTwo: extractNumberFromLine(lines[zeroOneIndex + 4] || '', 'RADST_2'),
        twoThree: extractNumberFromLine(lines[zeroOneIndex + 5] || '', 'RADST_3'),
    };
}

function cleanTyreWheelValue(value: string) {
    return value
        .replace(/\b35\.\s*Tyre\/wheel combination\s*:?\s*/i, '')
        .replace(/\bTyre\/wheel combination\s*:?\s*/i, '')
        .replace(/\baxle\s+\d+\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function repairVinFromTypePrefix(fin: string, type: string) {
    const normalizedFin = fin.trim().toUpperCase();
    const normalizedType = normalizeValue(type, 'TYPE').toUpperCase();
    if (normalizedFin.length !== 17 || normalizedType.length < 4) {
        return fin;
    }

    const embeddedTypePrefix = `SV3${normalizedType}`;
    const observedTypePrefix = normalizedFin.slice(0, embeddedTypePrefix.length);
    let differenceIndex = -1;

    for (let index = 0; index < embeddedTypePrefix.length; index++) {
        if (embeddedTypePrefix[index] !== observedTypePrefix[index]) {
            if (differenceIndex !== -1) {
                return fin;
            }
            differenceIndex = index;
        }
    }

    if (
        differenceIndex > -1
        && embeddedTypePrefix[differenceIndex] === 'T'
        && observedTypePrefix[differenceIndex] === '1'
    ) {
        return `${embeddedTypePrefix}${normalizedFin.slice(embeddedTypePrefix.length)}`;
    }

    return fin;
}

function extractTyreWheelByAxle(ocrText: string, axle: number) {
    const compact = ocrText.replace(/\s+/g, ' ');
    const nextAxle = axle + 1;
    const boundedPattern = new RegExp(String.raw`\baxle\s+${axle}\s+(.+?)(?=\s+axle\s+${nextAxle}\b|\s+Brakes\b|\s+36\.|\s+Bodywork\b)`, 'i');
    const bounded = compact.match(boundedPattern)?.[1] || '';
    const value = cleanTyreWheelValue(bounded);
    return value && /R\d{2}/i.test(value) ? value : '';
}

function cleanHitchApprovalValue(value: string) {
    return value
        .replace(/\b(Approval number or approval mark of coupling device|Genehmigungsnummer oder -zeichen der Anhaengevorrichtung|Genehmigungsnummer oder -zeichen der Anhängevorrichtung)\b[^:;]*:\s*/gi, '')
        .replace(/\/?\s*Numer\s+[^:;]*homologacji[^:;]*:\s*/gi, '')
        .replace(/\b(Drawbar|Overrunning device|Coupling head)\s*:\s*/gi, '')
        .replace(/\b55RO\b/g, '55R0')
        .replace(/\s*;\s*/g, '; ')
        .replace(/\s+/g, ' ')
        .replace(/^[/:\s]+/, '')
        .trim();
}

function extractHitchApproval(ocrText: string) {
    const compact = ocrText.replace(/\s+/g, ' ');
    const block = compact.match(/44\.\s*Approval number or approval mark of coupling device.*?:\s*(.+?)(?=\s*45\.1\.|\s*Characteristics values|\s*Miscellaneous|\s*50\.)/i)?.[1] || '';
    if (!block) {
        return '';
    }

    return cleanHitchApprovalValue(block);
}

function extractHitchCharacteristics(ocrText: string) {
    const compact = ocrText.replace(/\s+/g, ' ');
    const remarksBlock = compact.match(/Remarks:\s*(.+?)(?:\s+N\/A\s+N\/A|\s+Side\s+\d+|$)/i)?.[1] || '';
    if (remarksBlock && /\bD\s*=|\bD\s*:/i.test(remarksBlock)) {
        return remarksBlock
            .replace(/---+/g, '...')
            .replace(/\s+/g, ' ')
            .replace(/^[:;\s]+/, '')
            .trim();
    }

    const characteristicsBlock = compact.match(/45\.1\.\s*Characteristics values:\s*(.+?)(?=\s*Miscellaneous\b|\s*50\.)/i)?.[1] || '';
    if (characteristicsBlock && /\bD\s*=|\bD\s*:/i.test(characteristicsBlock)) {
        return characteristicsBlock
            .replace(/---+/g, '...')
            .replace(/\s+/g, ' ')
            .replace(/^[:;\s]+/, '')
            .trim();
    }

    const lines = ocrText.split(/\r?\n/);
    const startIndex = lines.findIndex((line) => /45\.1\./i.test(line));
    if (startIndex < 0) {
        return '';
    }

    const values: string[] = [];
    const firstLineValue = lines[startIndex].split(':').slice(1).join(':').trim();
    if (firstLineValue) {
        values.push(firstLineValue);
    }

    for (const line of lines.slice(startIndex + 1)) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        if (/^(Miscellaneous|50\.|51\.|52\.|Brakes|Bodywork)\b/i.test(trimmed)) {
            break;
        }

        if (/^(D|V|S|U)\s*:/i.test(trimmed) || /\bD\s*[=:]\s*[^,;]+(?:[,;]\s*)?\bS\s*[=:]/i.test(trimmed)) {
            values.push(trimmed);
        }
    }

    return cleanHitchCharacteristicValue(values.join(' '));
}

function applyOcrCorrections(data: CocData, confidences: Record<string, number>, ocrText: string) {
    const calculatedFields: string[] = [];
    const lines = normalizeLines(ocrText);
    const datePattern = String.raw`\d{1,2}[./-]\d{1,2}[./\-\s]+\d{4}`;
    const cocIssueDate = firstMatch(ocrText, new RegExp(String.raw`\(Place\)\s*\(Date\):[^\d]*(${datePattern})`, 'i'))
        || firstMatch(ocrText, new RegExp(String.raw`\(Miejscowo[^)]*\)\s*\(Data\):[^\d]*(${datePattern})`, 'i'))
        || firstMatch(ocrText, new RegExp(String.raw`(?:^|\n)[^\n]*\s+(${datePattern})r?\s*\n\(Place\s*\/\s*Miejscowo`, 'i'));
    if (cocIssueDate) {
        data.DAT_GENDOK = normalizeDate(cocIssueDate);
        confidences.DAT_GENDOK = Math.max(confidences.DAT_GENDOK || 0, 0.95);
    }

    const repairedFin = repairVinFromTypePrefix(data.FIN || '', data.TYPE || '');
    if (repairedFin !== data.FIN) {
        data.FIN = repairedFin;
        confidences.FIN = Math.max(confidences.FIN || 0, 0.9);
    }

    const wheelbase = extractWheelbase(lines);
    if (wheelbase) {
        data.RADST_1 = wheelbase;
        confidences.RADST_1 = Math.max(confidences.RADST_1 || 0, 0.95);
    }

    const axleSpacing = extractAxleSpacingByLabels(lines, ocrText);
    if (axleSpacing) {
        data.RADST_2 = axleSpacing.oneTwo;
        data.RADST_3 = axleSpacing.twoThree;
        data.RADST_4 = '';
        confidences.RADST_2 = axleSpacing.oneTwo ? 0.95 : 0;
        confidences.RADST_3 = axleSpacing.twoThree ? 0.95 : 0;
        confidences.RADST_4 = 0;
    }

    const tyreWheel = firstMatch(ocrText, /Tyre\/wheel combination[^:\n]*:\s*([^\r\n]+)/i)
        || firstMatch(ocrText, /Zesp[^\n]*opona\/ko[^\n]*:\s*([^\r\n]+)/i);
    if (tyreWheel) {
        data.RADREIFEN_ACHSE1 = cleanTyreWheelValue(tyreWheel);
        confidences.RADREIFEN_ACHSE1 = Math.max(confidences.RADREIFEN_ACHSE1 || 0, 0.95);
    }

    for (const axle of [1, 2, 3]) {
        const tyreValue = extractTyreWheelByAxle(ocrText, axle);
        if (tyreValue) {
            const key = `RADREIFEN_ACHSE${axle}`;
            data[key] = tyreValue;
            confidences[key] = Math.max(confidences[key] || 0, 0.95);
        }
    }

    const rearOverhang = firstMatch(ocrText, /12\.\s*Rear overhang[^:\n]*:\s*([^\r\n]+)/i)
        || firstMatch(ocrText, /Zwis tylny[^:\n]*:\s*([^\r\n]+)/i);
    if (rearOverhang) {
        data.UEBERH_HINTEN = normalizeValue(rearOverhang, 'UEBERH_HINTEN');
        confidences.UEBERH_HINTEN = Math.max(confidences.UEBERH_HINTEN || 0, 0.95);
    }

    const couplingStaticMass = firstMatch(ocrText, /19\.[\s\S]*?(?:coupling point|sprz[^\n]*centraln[^\n]*):\s*([0-9][0-9\s.,]*)\s*kg/i);
    if (couplingStaticMass) {
        data.TECH_ZUL_STUETZ = normalizeValue(couplingStaticMass, 'TECH_ZUL_STUETZ');
        confidences.TECH_ZUL_STUETZ = Math.max(confidences.TECH_ZUL_STUETZ || 0, 0.95);
    }

    if (!data.VERT_STUETZ && data.TECH_ZUL_STUETZ) {
        data.VERT_STUETZ = data.TECH_ZUL_STUETZ;
        confidences.VERT_STUETZ = Math.max(confidences.VERT_STUETZ || 0, 0.85);
    }

    const technicallyPermissibleMass = parseNumericField(data.TECH_ZUL_MASSE || '');
    const runningOrderMass = parseNumericField(data.MASSE_FAHRB || '');
    if (!data.HZUL_NUTZLAST && technicallyPermissibleMass !== null && runningOrderMass !== null) {
        const payload = technicallyPermissibleMass - runningOrderMass;
        if (payload >= 0) {
            data.HZUL_NUTZLAST = formatDerivedNumber(payload);
            confidences.HZUL_NUTZLAST = Math.max(confidences.HZUL_NUTZLAST || 0, 0.9);
            calculatedFields.push('HZUL_NUTZLAST');
        }
    }

    const hitchCharacteristics = extractHitchCharacteristics(ocrText)
        || firstMatch(ocrText, /45\.1\.\s*Characteristics values[^:\n]*:\s*([^\r\n]+)/i)
        || firstMatch(ocrText, /45\.1\.[^\n]*Warto[^\n]*charakterystyczne[^:\n]*:\s*([^\r\n]+)/i);
    if (hitchCharacteristics) {
        data.KENNW_ANHAENGEVORR = cleanHitchCharacteristicValue(hitchCharacteristics);
        confidences.KENNW_ANHAENGEVORR = Math.max(confidences.KENNW_ANHAENGEVORR || 0, 0.95);
    }

    const hitchApproval = extractHitchApproval(ocrText);
    if (hitchApproval) {
        data.ANHVORR_GENZ = hitchApproval;
        confidences.ANHVORR_GENZ = Math.max(confidences.ANHVORR_GENZ || 0, 0.95);
    }

    data.ANHVORR_GENZ = cleanHitchApprovalValue(data.ANHVORR_GENZ || '');
    data.KENNW_ANHAENGEVORR = cleanHitchCharacteristicValue(data.KENNW_ANHAENGEVORR || '');

    if (/\b55R00\*01-4422\b/i.test(data.ANHVORR_GENZ || '')) {
        confidences.ANHVORR_GENZ = Math.min(confidences.ANHVORR_GENZ || 0.5, 0.5);
    }

    return calculatedFields;
}

export function repairCocDataWithOcr(data: CocData, confidences: Record<string, number>, ocrText: string) {
    data.Aussteller = data.AUSST_GENDOK || data.Aussteller || '';
    data.Marke = data.MARKE || data.Marke || '';
    data.Typ = data.TYPE || data.Typ || '';
    const calculatedFields = applyOcrCorrections(data, confidences, ocrText);
    return { data, confidences, calculatedFields };
}

export class GeminiService {
    private apiKeys: string[];

    constructor() {
        const apiKeys = [
            ...(process.env.GEMINI_API_KEYS || '').split(','),
            process.env.GEMINI_API_KEY || '',
        ]
            .map((key) => key.trim())
            .filter(Boolean);

        this.apiKeys = Array.from(new Set(apiKeys));

        if (this.apiKeys.length === 0) {
            throw new Error('GEMINI_API_KEY or GEMINI_API_KEYS is missing');
        }
    }

    private async generateDocumentContent(
        base64Document: string,
        mimeType: string,
        prompt: string,
        config?: Record<string, unknown>
    ) {
        const configuredModels = [
            ...(process.env.GEMINI_MODELS || '').split(','),
            process.env.GEMINI_MODEL || '',
        ]
            .map((model) => model.trim())
            .filter(Boolean);
        const models = Array.from(new Set([
            ...configuredModels,
            'gemini-3.5-flash',
            'gemini-3.1-flash-lite',
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash',
            'gemini-flash-lite-latest',
            'gemini-flash-latest',
            'gemini-2.0-flash-lite',
            'gemini-2.0-flash',
            'gemini-2.5-pro',
        ]));
        let response: any = null;
        let lastError: unknown = null;

        generationLoop:
        for (let keyIndex = 0; keyIndex < this.apiKeys.length; keyIndex++) {
            const ai = new GoogleGenAI({ apiKey: this.apiKeys[keyIndex] });

            for (const model of models) {
                for (let attempt = 1; attempt <= 1; attempt++) {
                    const abortSignal = AbortSignal.timeout(25000);
                    const timeoutPromise = new Promise<never>((_, reject) => {
                        abortSignal.addEventListener('abort', () => {
                            reject(new Error(`Timeout during Gemini request with ${model}: 25000ms exceeded.`));
                        });
                    });

                    try {
                        console.log('[gemini] model attempt:', {
                            model,
                            attempt,
                            keyIndex,
                            responseMimeType: String(config?.responseMimeType || 'text/plain'),
                            hasSchema: Boolean(config?.responseJsonSchema || config?.responseSchema),
                        });
                        response = await Promise.race([
                            ai.models.generateContent({
                                model,
                                contents: [
                                    {
                                        role: 'user',
                                        parts: [
                                            { inlineData: { data: base64Document, mimeType } },
                                            { text: prompt }
                                        ]
                                    }
                                ],
                                config: config as any,
                            }),
                            timeoutPromise,
                        ]);
                        break generationLoop;
                    } catch (error) {
                        lastError = error;
                        console.error('[gemini] model attempt failed:', {
                            model,
                            attempt,
                            keyIndex,
                            message: error instanceof Error ? error.message : String(error),
                        });

                        if (!isTransientGeminiError(error)) {
                            throw error;
                        }

                        if (isQuotaGeminiError(error)) {
                            break;
                        }

                        await delay(750 * attempt);
                    }
                }
            }
        }

        if (!response) {
            throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Gemini request failed'));
        }

        return response;
    }



    async extractDataFromPdf(pdfBuffer: Buffer): Promise<CocData> {
        return this.extractDataFromDocument(pdfBuffer, 'application/pdf');
    }

    async extractDataFromDocument(documentBuffer: Buffer, mimeType: string): Promise<CocData> {
        const result = await this.extractDataWithConfidenceFromDocument(documentBuffer, mimeType);
        return result.data;
    }

    async extractDataWithConfidenceFromDocument(documentBuffer: Buffer, mimeType: string): Promise<CocExtractionResult> {
        const base64Document = documentBuffer.toString('base64');
        const prompt = `
You are an expert at extracting data from Certificates of Conformity (COC).
Analyze the provided COC document and extract every value needed for the BMD/GDB import template.

You are filling a BMD import CSV generated from an XLSX template.
The CSV/template has one row per GDB key in column A ("Feld GDB").
The system writes your extracted value into column D of the matching row.
Every JSON key below is therefore a concrete target CSV row. Extract the value that belongs into column D for that exact GDB key.

Use these exact output keys. If a value is not present, return an empty string with confidence 0:
${GDB_FIELD_KEYS.join(', ')}

Field map:
${GDB_FIELD_KEYS.map((key) => `- ${key}: ${FIELD_DEFINITIONS[key]}`).join('\n')}

Strict rules:
- The document may be a scanned image PDF. Read visible COC point numbers and table labels carefully.
- For missing non-applicable second/third/fourth axle fields, return empty string with confidence 0.
- For COC 4.1 axle spacing tables, map label "1-2" to RADST_2 and label "2-3" to RADST_3. Do not put the "0-1" value into RADST_2.
- For tyre/wheel fields, return only the tyre/wheel combination, without "axle 1", "axle 2", or the COC label text.
- For COC 45.1, include only real D/V/S/U characteristic values from Remarks when the 45.1 field points there. Do not output empty placeholders like "V: ..." or "U: ..."; if only D and S are real, output for example "D: 7,19 kN; S: 75 kg".

${FEW_SHOT_EXAMPLES}

Key hints:
- FIN = Fahrzeugidentifikationsnummer
- AUSST_GENDOK = Unterzeichner der Übereinstimmungsbescheinigung
- MARKE = Fabrikmarke / Hersteller
- TYPE = Typ
- VAR = Variante
- VERS = Version
- DAT_GENDOK = Datum der Übereinstimmungsbescheinigung
- LAENGE, BREITE, HOEHE = dimensions
- TECH_ZUL_MASSE and TECH_ZUL_ACHSL_* = technically permissible masses/axle loads
- RADREIFEN_ACHSE* = tyre/wheel data per axle

Return ONLY a pure JSON object matching the response schema.
Confidence must be a number from 0 to 1. Use lower confidence when OCR is unclear, field label is ambiguous, or the value is inferred.
${JSON.stringify(SCHEMA_EXAMPLE, null, 2)}
`;
        const response = await this.generateDocumentContent(base64Document, mimeType, prompt, {
            responseMimeType: 'application/json',
            responseSchema: FIELD_RESULT_SCHEMA as any,
            systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
            temperature: 0,
            topP: 0.1,
        });

        const rawText = response.text || '{}';
        console.log('[gemini] raw response:', rawText);

        try {
            const parsed = JSON.parse(rawText);
            console.log('[gemini] parsed json:', parsed);
            validateStructuredExtraction(parsed);

            const fields: FieldName[] = [...GDB_FIELD_KEYS];
            const data = fields.reduce((result, key) => {
                result[key] = normalizeField(parsed, key).value;
                return result;
            }, {} as CocData);
            data.Aussteller = data.AUSST_GENDOK || '';
            data.Marke = data.MARKE || '';
            data.Typ = data.TYPE || '';

            const hitchApprovalLooksLikeCharacteristics = /^\s*d\s*:/i.test(data.ANHVORR_GENZ || '');
            const hitchCharacteristicsLooksLikeApproval = /^\s*e\d/i.test(data.KENNW_ANHAENGEVORR || '');
            const swappedHitchFields = hitchApprovalLooksLikeCharacteristics && hitchCharacteristicsLooksLikeApproval;

            if (swappedHitchFields) {
                const approvalNumber = data.KENNW_ANHAENGEVORR;
                data.KENNW_ANHAENGEVORR = data.ANHVORR_GENZ;
                data.ANHVORR_GENZ = approvalNumber;
            }

            data.ANHVORR_GENZ = cleanHitchApprovalValue(data.ANHVORR_GENZ || '');
            data.KENNW_ANHAENGEVORR = cleanHitchCharacteristicValue(data.KENNW_ANHAENGEVORR || '');

            const confidences = fields.reduce((result, key) => {
                result[key] = normalizeField(parsed, key).confidence;
                return result;
            }, {} as Record<string, number>);
            confidences.Aussteller = confidences.AUSST_GENDOK ?? 0;
            confidences.Marke = confidences.MARKE ?? 0;
            confidences.Typ = confidences.TYPE ?? 0;

            if (swappedHitchFields) {
                confidences.ANHVORR_GENZ = Math.min(confidences.ANHVORR_GENZ ?? 1, 0.9);
                confidences.KENNW_ANHAENGEVORR = Math.min(confidences.KENNW_ANHAENGEVORR ?? 1, 0.9);
            }

            const ocrText = typeof parsed._OCR_TEXT === 'string' ? parsed._OCR_TEXT : '';
            const calculatedFields = applyOcrCorrections(data, confidences, ocrText);

            console.log('[gemini] normalized data:', data);
            console.log('[gemini] confidences:', confidences);

            return { data, confidences, raw: parsed, ocrText, promptVersion: COC_EXTRACTION_PROMPT_VERSION, calculatedFields };
        } catch {
            throw new Error('Failed to parse Gemini output as JSON: ' + rawText);
        }
    }
}
