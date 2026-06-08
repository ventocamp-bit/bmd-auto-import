import { config } from 'dotenv';
import { DriveService } from './src/driveService';
import { GeminiService } from './src/geminiService';
import { ExcelService } from './src/excelService';

config();

async function runLocalTest() {
    try {
        console.log('Starting local Webhook test...');
        
        // Mock a file ID that would normally come from the Webhook
        const fileId = process.env.TEST_FILE_ID; 
        const targetFolderId = process.env.DRIVE_TARGET_FOLDER_ID;

        if (!fileId || !targetFolderId) {
            throw new Error('Missing TEST_FILE_ID or DRIVE_TARGET_FOLDER_ID in .env');
        }

        const driveService = new DriveService();
        const geminiService = new GeminiService();
        const excelService = new ExcelService();

        console.log(`Fetching file details for ID: ${fileId}...`);
        const file = await driveService.getFile(fileId);

        if (!file || !file.name) {
            console.log('File not found.');
            return;
        }

        console.log(`Found file: ${file.name}. Processing...`);

        if (file.name.toLowerCase().endsWith('.pdf')) {
            console.log(`Downloading PDF: ${file.name}`);
            const pdfBuffer = await driveService.downloadFile(file.id!);
            
            console.log(`Extracting data via Gemini for: ${file.name}`);
            const extractedData = await geminiService.extractDataFromPdf(pdfBuffer);
            console.log('Extracted Data:', extractedData);
            
            console.log(`Injecting data into Template for: ${file.name}`);
            const csvBuffer = excelService.generateCsvBuffer(extractedData);
            const outputName = `${extractedData.FIN || 'UNKNOWN'}_BMD_Import.csv`;
            
            console.log(`Uploading Excel as: ${outputName}`);
            await driveService.uploadFile(
                outputName,
                csvBuffer,
                targetFolderId,
                'text/csv; charset=utf-8'
            );

            console.log(`Deleting original PDF (Simulated): ${file.name}`);
            // await driveService.deleteFile(file.id!); // Commented out for local testing safety
            console.log('Successfully processed', file.name);
        } else {
            console.log('Not a PDF. Skipping Gemini processing.');
        }

    } catch (err) {
        console.error('Test failed:', err);
    }
}

runLocalTest();
