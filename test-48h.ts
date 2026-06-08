import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { GeminiService } from './src/geminiService';
import { ExcelService } from './src/excelService';

config();

async function run48hTest() {
    try {
        console.log('--- STARTING 48H PROOF TEST ---');
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('[ERROR] GEMINI_API_KEY is missing.');
            return;
        }

        const testDir = path.join(process.cwd(), 'test-pdfs');
        if (!fs.existsSync(testDir)) {
            console.log(`[INFO] Creating directory ${testDir}. Please place your 3 test PDFs (Drival, Niewiadow, Tomplan) there.`);
            fs.mkdirSync(testDir);
            return;
        }

        const files = fs.readdirSync(testDir).filter(f => f.toLowerCase().endsWith('.pdf'));
        if (files.length === 0) {
            console.log(`[INFO] No PDFs found in ${testDir}. Please place your 3 test PDFs there.`);
            return;
        }

        const geminiService = new GeminiService();
        const excelService = new ExcelService();

        for (const file of files) {
            const pdfPath = path.join(testDir, file);
            console.log(`\n===========================================`);
            console.log(`Verarbeite PDF: ${file}`);
            console.log(`===========================================`);
            
            const pdfBuffer = fs.readFileSync(pdfPath);
            
            console.log('Sende PDF an Gemini zur Extraktion...');
            const startTime = Date.now();
            const result = await geminiService.extractDataWithConfidenceFromDocument(pdfBuffer, 'application/pdf');
            const duration = Date.now() - startTime;
            
            console.log(`\n[gemini] Extraktion abgeschlossen in ${duration}ms`);
            
            console.log('\n--- EXTRAHIERTE DATEN ---');
            console.log(JSON.stringify(result.data, null, 2));
            
            console.log('\n--- CONFIDENCE WERTE ---');
            console.log(JSON.stringify(result.confidences, null, 2));
            
            console.log('\nBefülle Excel-Template...');
            const excelBuffer = excelService.generateCsvBuffer(result.data);
            
            const outputFilename = `${file.replace('.pdf', '')}_BMD_Import.csv`;
            const outputPath = path.join(process.cwd(), outputFilename);
            
            fs.writeFileSync(outputPath, excelBuffer);
            console.log(`[SUCCESS] Excel-Datei erstellt: ${outputPath}`);
        }
        
        console.log('\n--- 48H PROOF TEST BEENDET ---');
    } catch (err) {
        console.error('Test fehlgeschlagen:', err);
    }
}

run48hTest();
