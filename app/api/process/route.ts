import { NextRequest, NextResponse } from 'next/server';
import { DriveService } from '../../../src/driveService';
import { ExcelService } from '../../../src/excelService';
import { GeminiService } from '../../../src/geminiService';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const authHeader = request.headers.get('authorization');

    if (!webhookSecret) {
        return NextResponse.json(
            { error: 'Configuration Error', message: 'Missing WEBHOOK_SECRET in environment variables.' },
            { status: 500 }
        );
    }

    if (authHeader !== `Bearer ${webhookSecret}`) {
        return NextResponse.json(
            { error: 'Unauthorized', message: 'Invalid or missing webhook secret.' },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const fileId = body.fileId;

        if (!fileId) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'fileId is required in the request body.' },
                { status: 400 }
            );
        }

        const targetFolderId = process.env.DRIVE_TARGET_FOLDER_ID;
        if (!targetFolderId) {
            return NextResponse.json(
                { error: 'Configuration Error', message: 'Missing DRIVE_TARGET_FOLDER_ID in environment variables.' },
                { status: 500 }
            );
        }

        const driveService = new DriveService();
        const excelService = new ExcelService();
        const file = await driveService.getFile(fileId);

        if (!file || !file.name) {
            return NextResponse.json(
                { error: 'Not Found', message: 'File not found or has no name.' },
                { status: 404 }
            );
        }

        const fileName = file.name.toLowerCase();
        const isExcelOrCsv = fileName.endsWith('.xlsx') || fileName.endsWith('.csv');

        if (isExcelOrCsv) {
            await driveService.moveFile(fileId, targetFolderId);
            return NextResponse.json({ message: 'File moved successfully', file: file.name, status: 'moved' });
        }

        if (fileName.endsWith('.pdf')) {
            const geminiService = new GeminiService();
            const pdfBuffer = await driveService.downloadFile(fileId);
            const extractedData = await geminiService.extractDataFromPdf(pdfBuffer);
            const csvBuffer = excelService.generateCsvBuffer(extractedData);
            const outputName = `${extractedData.FIN || 'UNKNOWN'}_BMD_Import.csv`;

            await driveService.uploadFile(
                outputName,
                csvBuffer,
                targetFolderId,
                'text/csv; charset=utf-8'
            );

            await driveService.deleteFile(fileId);

            return NextResponse.json({
                message: 'PDF processed successfully',
                file: file.name,
                status: 'processed_and_deleted',
                output: outputName,
            });
        }

        return NextResponse.json({ message: 'Unsupported file type', file: file.name }, { status: 400 });
    } catch (error: any) {
        console.error('Drive webhook processing error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
