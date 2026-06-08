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
};

type BatchExportDocument = {
    id: string;
    originalName: string;
    data: CocData;
    confidences?: Record<string, number>;
    calculatedFields?: string[];
};

export class ExcelService {
    private getTemplateName(data: CocData) {
        const marke = data.Marke ? data.Marke.trim() : '';

        if (marke.toLowerCase().includes('drival') || marke.toLowerCase().includes('daltec')) return 'Drival_COC.xlsx';
        if (marke.toLowerCase().includes('niewiadow')) return 'Niewiadow_COC.xlsx';
        if (marke.toLowerCase().includes('tomplan')) return 'Tomplan_COC.xlsx';
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
        const value = data[gdbKey] ?? (aliasJsonKey ? data[aliasJsonKey] : undefined);
        const textValue = typeof value === 'string' ? value.trim() : '';
        const confidence = options?.confidences?.[gdbKey];
        const threshold = options?.confidenceThreshold ?? 0.7;
        const uncertain = typeof confidence === 'number' && confidence < threshold;

        if (uncertain && textValue) {
            return `${textValue} ${options?.lowConfidenceMarker || '[???]'}`;
        }

        if (textValue && options?.calculatedFields?.includes(gdbKey)) {
            return `${textValue} [CALC]`;
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
                const value = this.valueForExport(data, colAValue, options);

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

    generateBatchXlsxBuffer(documents: BatchExportDocument[]): Buffer {
        const grouped = documents.reduce((result, document) => {
            const templateName = this.getTemplateName(document.data);
            if (!result[templateName]) {
                result[templateName] = [];
            }
            result[templateName].push(document);
            return result;
        }, {} as Record<string, BatchExportDocument[]>);

        const outputWorkbook = xlsx.utils.book_new();

        for (const [templateName, templateDocuments] of Object.entries(grouped)) {
            const templateWorkbook = this.readTemplateWorkbook(templateName);
            const sourceSheetName = templateWorkbook.SheetNames[0];
            const sourceSheet = templateWorkbook.Sheets[sourceSheetName];
            const sheet = xlsx.utils.sheet_to_json(sourceSheet, { header: 1, blankrows: true }) as unknown[][];
            const range = xlsx.utils.decode_range(sourceSheet['!ref'] || 'A1:D100');

            for (let index = 0; index < templateDocuments.length; index++) {
                const document = templateDocuments[index];
                const valueColumn = 3 + index;
                const header = document.data.FIN || document.originalName || document.id;

                if (!sheet[0]) {
                    sheet[0] = [];
                }
                sheet[0][valueColumn] = header;

                for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
                    const gdbKey = String(sheet[rowIndex]?.[0] || '').trim();
                    if (!gdbKey) {
                        continue;
                    }

                    if (!sheet[rowIndex]) {
                        sheet[rowIndex] = [];
                    }

                    sheet[rowIndex][valueColumn] = this.valueForExport(document.data, gdbKey, {
                        confidences: document.confidences,
                        lowConfidenceMarker: '[???]',
                        calculatedFields: document.calculatedFields,
                    });
                }
            }

            const outputSheet = xlsx.utils.aoa_to_sheet(sheet);
            outputSheet['!cols'] = sourceSheet['!cols'];
            outputSheet['!rows'] = sourceSheet['!rows'];
            const sheetName = templateName.replace(/_COC\.xlsx$/i, '').slice(0, 31);
            xlsx.utils.book_append_sheet(outputWorkbook, outputSheet, sheetName);
        }

        const buffer = xlsx.write(outputWorkbook, {
            type: 'buffer',
            bookType: 'xlsx',
            cellStyles: true,
        });

        return Buffer.from(buffer);
    }
}
