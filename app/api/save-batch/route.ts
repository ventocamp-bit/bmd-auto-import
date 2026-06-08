import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { buildBatchExportDocuments } from '../../../src/batchExportService';
import { ExcelService } from '../../../src/excelService';
import { DocumentRecord, getSupabaseAdmin } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .in('status', ['success', 'review'])
        .order('created_at', { ascending: true })
        .limit(500);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const documents = buildBatchExportDocuments((data || []) as DocumentRecord[]);

    if (documents.length === 0) {
        return NextResponse.json({ error: 'No processed documents available for batch export' }, { status: 404 });
    }

    const excelService = new ExcelService();
    const bytes = excelService.generateBatchXlsxBuffer(documents);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `BMD_Sammelimport_${date}.xlsx`;
    const downloadsDir = join(homedir(), 'Downloads');
    const outputPath = join(downloadsDir, filename);

    await mkdir(downloadsDir, { recursive: true });
    await writeFile(outputPath, bytes);

    return NextResponse.json({ ok: true, path: outputPath, filename, count: documents.length });
}
