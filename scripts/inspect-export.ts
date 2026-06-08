import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const filePath = process.argv[2];

if (!filePath) {
    throw new Error('Usage: npm run inspect:export -- <path-to-xlsx>');
}

const workbook = xlsx.readFile(filePath, { cellStyles: true });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1:A1');
const requiredGdbKeys = new Set(['FIN', 'AUSST_GENDOK', 'MARKE', 'TYPE']);

const rows = [];

for (let row = range.s.r; row <= range.e.r; row++) {
    const keyAddress = xlsx.utils.encode_cell({ r: row, c: 0 });
    const valueAddress = xlsx.utils.encode_cell({ r: row, c: 3 });
    const key = worksheet[keyAddress]?.v;

    if (requiredGdbKeys.has(String(key || '').trim())) {
        rows.push({
            row: row + 1,
            key,
            valueAddress,
            value: worksheet[valueAddress]?.v ?? '',
            hasStyle: Boolean(worksheet[valueAddress]?.s),
        });
    }
}

console.log(JSON.stringify({
    filePath,
    sheetName,
    ref: worksheet['!ref'],
    cols: worksheet['!cols']?.length || 0,
    rowsMeta: worksheet['!rows']?.length || 0,
    found: rows,
    missingValues: rows.filter((row) => !row.value).map((row) => row.key),
}, null, 2));
