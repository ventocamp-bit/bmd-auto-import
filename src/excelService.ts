import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { CocData } from './geminiService';

export class ExcelService {
    generateExcelBuffer(data: CocData): Buffer {
        const marke = data.Marke ? data.Marke.trim() : '';
        
        let templateName = 'Drival_COC.xlsx'; // Default fallback
        if (marke.toLowerCase().includes('drival')) templateName = 'Drival_COC.xlsx';
        else if (marke.toLowerCase().includes('niewiadow')) templateName = 'Niewiadow_COC.xlsx';
        else if (marke.toLowerCase().includes('tomplan')) templateName = 'Tomplan_COC.xlsx';

        const templatePath = path.join(process.cwd(), 'templates', templateName);
        
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        const wb = xlsx.readFile(templatePath, { cellStyles: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        const keyMapping: { [key: string]: string } = {
            'FIN': 'FIN',
            'Aussteller': 'AUSST_GENDOK',
            'Marke': 'MARKE',
            'Typ': 'TYPE'
        };

        const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A100');
        
        for (let R = range.s.r; R <= range.e.r; R++) {
            const cellAddress = xlsx.utils.encode_cell({ r: R, c: 0 }); // Column A
            const cell = ws[cellAddress];
            
            if (cell && cell.v) {
                const colAValue = cell.v.toString().trim();
                
                for (const [jsonKey, gdbKey] of Object.entries(keyMapping)) {
                    if (colAValue === gdbKey && (data as any)[jsonKey]) {
                        const targetCellAddress = xlsx.utils.encode_cell({ r: R, c: 3 }); // Column D
                        ws[targetCellAddress] = { t: 's', v: (data as any)[jsonKey] };
                        
                        // Update worksheet range if we wrote outside the current bounds
                        if (R > range.e.r || 3 > range.e.c) {
                            const newRange = { s: range.s, e: { r: Math.max(range.e.r, R), c: Math.max(range.e.c, 3) } };
                            ws['!ref'] = xlsx.utils.encode_range(newRange);
                        }
                    }
                }
            }
        }
        
        return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
}
