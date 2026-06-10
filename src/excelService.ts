import { createRequire } from 'module';
import * as path from 'path';
import * as fs from 'fs';
import { CocData } from './geminiService';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

type ExportOptions = {
    confidences?: Record<string, number>;
    confidenceThreshold?: number;
    lowConfidenceMarker?: string;
    calculatedFields?: string[];
    preserveAuthorityDefaults?: boolean;
};

type BatchExportDocument = {
    id: string;
    originalName: string;
    data: CocData;
    confidences?: Record<string, number>;
    calculatedFields?: string[];
};

const NUMERIC_EXPORT_FIELDS = new Set([
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

const AUTHORITY_DEFAULT_FIELDS = new Set([
    'VERT_STUETZ',
    'HZUL_NUTZLAST',
    'HZUL_MINDEST',
    'AUFBAU_EU_C',
    'FARBE_C',
    'KUNDENNr',
    'TypSMail',
]);

const NIEWIADOW_B1_DEFAULT_FIELDS = new Set([
    'AUSST_GENDOK',
    'MARKE',
    'TYPE',
    'VAR',
    'VERS',
    'REVISION_GEN',
    'DAT_GENDOK',
    'VERT_STUETZ',
    'HZUL_NUTZLAST',
    'HZUL_MINDEST',
    'TECH_ZUL_ACHSGR_1',
    'RADREIFEN_ACHSE1',
    'ANHVORR_GENZ',
    'KENNW_ANHAENGEVORR',
    'FARBE_C',
    'KUNDENNr',
    'TypSMail',
]);

function comparableText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase();
}

function firstNumber(value: string) {
    if (/^(n\/?a|not applicable|nicht zutreffend|nie dotyczy|-|--|---)?$/i.test(value.trim())) {
        return '';
    }

    const match = value.match(/([0-9][0-9\s.,]*)/);
    const beforeNumber = match ? value.slice(0, match.index).trim() : '';
    if (/\b(Masses|Masy|General construction|Technically|Track|Axles|Wheelbase|Length|Width|Height)\b/i.test(beforeNumber)) {
        return '';
    }

    return match ? match[1].replace(/\s+/g, '').replace(',', '.').trim() : '';
}

function cleanBodyworkCode(value: string) {
    const match = value.match(/\b([A-Z]{1,3})\s*-?\s*([0-9]{1,3})\b/i);
    return match ? { letters: match[1].toUpperCase(), digits: match[2] } : { letters: '', digits: '' };
}

function isNiewiadowBs750(data: CocData) {
    const manufacturer = comparableText(data.MARKE || data.Marke || '');
    const type = comparableText(data.TYPE || data.Typ || '');
    return manufacturer.includes('NIEWIADOW') && type === 'BS750';
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

function isAuthorityInstructionText(value: string) {
    return /\b(Geben Sie|Sofern|Falls|Sollte|Finanzen|österreichische Genehmigungsdatenbank|Genehmigungsdatenbank|in dieser Zelle)\b/i.test(value);
}

function cleanValueCellStyle(style: Record<string, unknown> | undefined) {
    if (!style) return undefined;

    const {
        patternType,
        fgColor,
        bgColor,
        ...rest
    } = style;

    return Object.keys(rest).length > 0 ? rest : undefined;
}

export class ExcelService {
    private getTemplateName(data: CocData) {
        const marke = comparableText(data.Marke || data.MARKE || '');
        const type = (data.TYPE || data.Typ || '').trim().toLowerCase();
        const fin = (data.FIN || '').trim().toUpperCase();

        if (marke.includes('DRIVAL') || marke.includes('DALTEC')) return 'Drival_COC.xlsx';
        if (marke.includes('NIEWIADOW') && (type === 'b1' || fin.startsWith('SZRB'))) return 'Niewiadow_B1_COC.xlsx';
        if (marke.includes('NIEWIADOW')) return 'Niewiadow_COC.xlsx';
        if (marke.includes('TOMPLAN')) return 'Tomplan_COC.xlsx';
        return 'Drival_COC.xlsx';
    }

    private readTemplateWorkbook(templateName: string) {
        const templatePath = path.join(process.cwd(), 'templates', templateName);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        const templateBuffer = fs.readFileSync(templatePath);
        return xlsx.read(templateBuffer, { type: 'buffer', cellStyles: true });
    }

    private valueForExport(data: CocData, gdbKey: string, options?: ExportOptions) {
        const keyMapping: { [key: string]: string } = {
            'FIN': 'FIN',
            'Aussteller': 'AUSST_GENDOK',
            'Marke': 'MARKE',
            'Typ': 'TYPE'
        };
        const aliasJsonKey = Object.entries(keyMapping).find(([, mappedGdbKey]) => mappedGdbKey === gdbKey)?.[0];
        let value = data[gdbKey] ?? (aliasJsonKey ? data[aliasJsonKey] : undefined);
        const rawTextValue = typeof value === 'string' ? value.trim() : '';
        let textValue = /^[:;.,\-\s]+$/.test(rawTextValue) ? '' : rawTextValue;
        const confidence = options?.confidences?.[gdbKey];
        const threshold = options?.confidenceThreshold ?? 0.7;
        const uncertain = typeof confidence === 'number' && confidence < threshold;

        const manufacturer = comparableText(data.MARKE || data.Marke || '');
        const isOneAxle = !firstNumber(data.TECH_ZUL_ACHSL_2 || '')
            && !firstNumber(data.VERT_ACHSE_2 || '')
            && !firstNumber(data.RADST_2 || '');

        if (gdbKey === 'HANDNAME') {
            const handName = comparableText(textValue);
            return !handName || handName === manufacturer ? '' : textValue;
        }

        if (gdbKey === 'SPURW_1' && isOneAxle && !firstNumber(textValue)) {
            textValue = data.SPURW_2 || '';
        }

        if (gdbKey === 'SPURW_2' && isOneAxle) {
            return '';
        }

        if (gdbKey === 'AUFBAU_EU_C') {
            const code = cleanBodyworkCode(textValue || data.AUFBAU_NAT_C || '');
            return code.letters || textValue;
        }

        if (gdbKey === 'AUFBAU_NAT_C') {
            const code = cleanBodyworkCode(textValue || data.AUFBAU_EU_C || '');
            return code.digits || textValue || (isNiewiadowBs750(data) ? '14' : '');
        }

        if (gdbKey === 'KENNW_ANHAENGEVORR') {
            const cleaned = cleanHitchCharacteristicValue(textValue);
            if (isNiewiadowBs750(data) && /^D:\s*7[,.]7\s*kN$/i.test(cleaned)) {
                return `${cleaned}; S: 75 kg`;
            }
            return cleaned;
        }

        const numericField = NUMERIC_EXPORT_FIELDS.has(gdbKey);

        if (numericField) {
            textValue = firstNumber(textValue);
        }

        if (!numericField && uncertain && textValue) {
            return `${textValue} ${options?.lowConfidenceMarker || '[???]'}`;
        }

        return textValue;
    }

    private buildWorkbook(data: CocData, options?: ExportOptions) {
        console.log('[excel] mapping input:', data);
        const templateName = this.getTemplateName(data);
        console.log('[excel] selected template:', templateName);

        const wb = this.readTemplateWorkbook(templateName);
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A100');
        
        for (let R = range.s.r; R <= range.e.r; R++) {
            const cellAddress = xlsx.utils.encode_cell({ r: R, c: 0 }); // Column A
            const cell = ws[cellAddress];
            
            if (cell && cell.v) {
                const colAValue = cell.v.toString().trim();
                
                const targetCellAddress = xlsx.utils.encode_cell({ r: R, c: 3 }); // Column D
                const defaultRawValue = typeof ws[targetCellAddress]?.v === 'string' ? ws[targetCellAddress].v : '';
                const hasDefaultValue = typeof ws[targetCellAddress]?.v === 'string'
                    && ws[targetCellAddress].v.length > 0
                    && !isAuthorityInstructionText(ws[targetCellAddress].v);
                const preserveDefault = options?.preserveAuthorityDefaults
                    && hasDefaultValue
                    && (
                        AUTHORITY_DEFAULT_FIELDS.has(colAValue)
                        || (templateName === 'Niewiadow_B1_COC.xlsx' && NIEWIADOW_B1_DEFAULT_FIELDS.has(colAValue))
                    );
                const value = preserveDefault
                    ? defaultRawValue
                    : this.valueForExport(data, colAValue, options);

                ws[targetCellAddress] = { t: 's', v: value };
                console.log('[excel] mapped csv field:', { gdbKey: colAValue, targetCellAddress, value });

                if (R > range.e.r || 3 > range.e.c) {
                    const newRange = { s: range.s, e: { r: Math.max(range.e.r, R), c: Math.max(range.e.c, 3) } };
                    ws['!ref'] = xlsx.utils.encode_range(newRange);
                }
            }
        }
        
        return wb;
    }

    generateCsvBuffer(data: CocData): Buffer {
        const wb = this.buildWorkbook(data);
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const csv = xlsx.utils.sheet_to_csv(ws, {
            FS: ';',
            RS: '\r\n',
            blankrows: true,
        });

        return Buffer.from(`\uFEFF${csv}`, 'utf8');
    }

    generateAuthorityXlsxBuffer(data: CocData): Buffer {
        const wb = this.buildWorkbook(data, { preserveAuthorityDefaults: true });
        const buffer = xlsx.write(wb, {
            type: 'buffer',
            bookType: 'xlsx',
            cellStyles: true,
        });

        return Buffer.from(buffer);
    }

    generateBatchXlsxBuffer(documents: BatchExportDocument[]): Buffer {
        if (documents.length === 0) {
            throw new Error('No documents supplied for batch export');
        }

        const templateName = this.getTemplateName(documents[0].data);
        const workbook = this.readTemplateWorkbook(templateName);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1:D100');
        const templateValueCol = 3;

        for (let documentIndex = 0; documentIndex < documents.length; documentIndex++) {
            const document = documents[documentIndex];
            const valueColumn = templateValueCol + documentIndex;

            if (documentIndex > 0 && sheet['!cols']?.[templateValueCol]) {
                sheet['!cols'][valueColumn] = { ...sheet['!cols'][templateValueCol] };
            }

            for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
                const gdbCellAddress = xlsx.utils.encode_cell({ r: rowIndex, c: 0 });
                const gdbKey = String(sheet[gdbCellAddress]?.v || '').trim();
                if (!gdbKey) {
                    continue;
                }

                const sourceValueAddress = xlsx.utils.encode_cell({ r: rowIndex, c: templateValueCol });
                const targetValueAddress = xlsx.utils.encode_cell({ r: rowIndex, c: valueColumn });
                const sourceCell = sheet[sourceValueAddress];
                const defaultRawValue = typeof sourceCell?.v === 'string' ? sourceCell.v : '';
                const hasDefaultValue = typeof sourceCell?.v === 'string'
                    && sourceCell.v.length > 0
                    && !isAuthorityInstructionText(sourceCell.v);
                const preserveDefault = hasDefaultValue
                    && (
                        AUTHORITY_DEFAULT_FIELDS.has(gdbKey)
                        || (templateName === 'Niewiadow_B1_COC.xlsx' && NIEWIADOW_B1_DEFAULT_FIELDS.has(gdbKey))
                    );
                const value = preserveDefault
                    ? defaultRawValue
                    : this.valueForExport(document.data, gdbKey, {
                        confidences: document.confidences,
                        lowConfidenceMarker: '[???]',
                        calculatedFields: document.calculatedFields,
                    });

                const cleanStyle = cleanValueCellStyle(sourceCell?.s);
                sheet[targetValueAddress] = {
                    ...(cleanStyle ? { s: cleanStyle } : {}),
                    t: 's',
                    v: value,
                };
            }
        }

        sheet['!ref'] = xlsx.utils.encode_range({
            s: range.s,
            e: {
                r: range.e.r,
                c: Math.max(range.e.c, templateValueCol + documents.length - 1),
            },
        });

        const buffer = xlsx.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx',
            cellStyles: true,
        });

        return Buffer.from(buffer);
    }
}
