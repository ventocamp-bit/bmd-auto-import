import { VercelRequest, VercelResponse } from '@vercel/node';
import { DriveService } from '../src/driveService';
import { GeminiService } from '../src/geminiService';
import { ExcelService } from '../src/excelService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // We only accept POST requests for the webhook
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST requests are accepted.' });
    }

    try {
        const webhookSecret = process.env.WEBHOOK_SECRET;
        
        if (!webhookSecret) {
            return res.status(500).json({ error: 'Configuration Error', message: 'Missing WEBHOOK_SECRET in environment variables.' });
        }
        
        const authHeader = req.headers.authorization;

        if (authHeader !== `Bearer ${webhookSecret}`) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing webhook secret.' });
        }

        const { fileId } = req.body;
        
        if (!fileId) {
            return res.status(400).json({ error: 'Bad Request', message: 'fileId is required in the request body.' });
        }

        const targetFolderId = process.env.DRIVE_TARGET_FOLDER_ID;
        if (!targetFolderId) {
            return res.status(500).json({ error: 'Configuration Error', message: 'Missing DRIVE_TARGET_FOLDER_ID in environment variables.' });
        }

        const driveService = new DriveService();
        const excelService = new ExcelService();

        // 1. Fetch the file details
        const file = await driveService.getFile(fileId);

        if (!file || !file.name) {
            return res.status(404).json({ error: 'Not Found', message: 'File not found or has no name.' });
        }

        // 2. If it's an Excel or CSV, just move it directly
        const isExcelOrCsv = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.csv');
        if (isExcelOrCsv) {
            await driveService.moveFile(fileId, targetFolderId);
            return res.status(200).json({ message: 'File moved successfully', file: file.name, status: 'moved' });
        }

        // 3. If it's a PDF, process it through Gemini and inject into Template
        if (file.name.toLowerCase().endsWith('.pdf')) {
            const geminiService = new GeminiService();
            const pdfBuffer = await driveService.downloadFile(fileId);
            
            // Extract data via Gemini
            const extractedData = await geminiService.extractDataFromPdf(pdfBuffer);
            
            // Inject data into the matching template
            const excelBuffer = excelService.generateExcelBuffer(extractedData);
            const outputName = `${extractedData.FIN || 'UNKNOWN'}_BMD_Import.xlsx`;
            
            // Upload the generated Excel to the target folder
            await driveService.uploadFile(
                outputName,
                excelBuffer,
                targetFolderId,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );

            // Delete the original PDF only after successful upload
            await driveService.deleteFile(fileId);
            
            return res.status(200).json({ 
                message: 'PDF processed successfully', 
                file: file.name, 
                status: 'processed_and_deleted', 
                output: outputName 
            });
        }

        return res.status(400).json({ message: 'Unsupported file type', file: file.name });
    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
