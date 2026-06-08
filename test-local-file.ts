import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { GeminiService } from './src/geminiService';
import { ExcelService } from './src/excelService';

config();

async function runLocalFileTest() {
    try {
        console.log('--- STARTING LOCAL FILE TEST ---');
        
        const apiKey = process.env.GEMINI_API_KEY;
        const testPdfPath = path.join(process.cwd(), 'test.pdf');
        
        // Check if we should fall back to Mock Mode
        if (!apiKey || !fs.existsSync(testPdfPath)) {
            console.log('\n[INFO] Starte im MOCK-Modus (Kein GEMINI_API_KEY oder keine "test.pdf" gefunden).');
            console.log('Es werden Test-Excel-Dateien für alle 3 Händler (Drival, Niewiadow, Tomplan) generiert...\n');
            
            const excelService = new ExcelService();
            const mockDataset = [
                {
                    FIN: 'MOCKDRIVAL1234567',
                    Aussteller: 'Drival Trailer Group Sp. z o.o.',
                    Marke: 'Drival',
                    Typ: 'DR-CARGO-2026'
                },
                {
                    FIN: 'MOCKNIEWIADOW890',
                    Aussteller: 'Fabryka Przyczep Niewiadow Sp. z o.o.',
                    Marke: 'Niewiadow',
                    Typ: 'N-CLASSIC-126'
                },
                {
                    FIN: 'MOCKTOMPLAN45678',
                    Aussteller: 'Tomplan Sp. z o.o. Manufacturing',
                    Marke: 'Tomplan',
                    Typ: 'TP-CARGO-PRO'
                }
            ];

            for (const mockData of mockDataset) {
                console.log(`Verarbeite Template für Marke: ${mockData.Marke}...`);
                const excelBuffer = excelService.generateCsvBuffer(mockData);
                const outputFilename = `${mockData.FIN}_BMD_Import_mock.csv`;
                const outputPath = path.join(process.cwd(), outputFilename);
                
                fs.writeFileSync(outputPath, excelBuffer);
                console.log(`[SUCCESS] Excel-Datei erstellt: ${outputFilename}`);
            }
            
            console.log('\n-------------------------------------------------------------');
            console.log('FERTIG: Du kannst nun folgende Dateien in Excel überprüfen:');
            console.log('1. MOCKDRIVAL1234567_BMD_Import_mock.csv (Drival Template)');
            console.log('2. MOCKNIEWIADOW890_BMD_Import_mock.csv (Niewiadow Template)');
            console.log('3. MOCKTOMPLAN45678_BMD_Import_mock.csv (Tomplan Template)');
            console.log('-------------------------------------------------------------\n');
            return;
        }

        // Real PDF Processing Mode
        console.log(`Lese lokale PDF-Datei: ${testPdfPath}...`);
        const pdfBuffer = fs.readFileSync(testPdfPath);

        const geminiService = new GeminiService();
        const excelService = new ExcelService();

        console.log('Sende PDF an Gemini zur Extraktion...');
        const extractedData = await geminiService.extractDataFromPdf(pdfBuffer);
        
        console.log('\n--- EXTRAHIERTE DATEN VON GEMINI ---');
        console.log(JSON.stringify(extractedData, null, 2));
        console.log('------------------------------------\n');

        console.log('Befülle Excel-Template...');
        const excelBuffer = excelService.generateCsvBuffer(extractedData);
        
        const outputFilename = `${extractedData.FIN || 'UNKNOWN'}_BMD_Import_local.csv`;
        const outputPath = path.join(process.cwd(), outputFilename);
        
        fs.writeFileSync(outputPath, excelBuffer);
        console.log(`[SUCCESS] Lokale Excel-Datei erfolgreich erstellt: ${outputPath}`);
        console.log('Du kannst diese Excel-Datei jetzt öffnen und das Layout überprüfen.');

    } catch (err) {
        console.error('Test fehlgeschlagen:', err);
    }
}

runLocalFileTest();
