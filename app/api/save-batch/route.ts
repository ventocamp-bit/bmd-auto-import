import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { ExcelService } from '../../../src/excelService';
import { CocData } from '../../../src/geminiService';
import { DocumentRecord, getSupabaseAdmin } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function archivedAt(doc: DocumentRecord) {
    const value = doc.uncertainties?.archivedAt;
    return typeof value === 'string' ? value : null;
}

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

    const documents = ((data || []) as DocumentRecord[])
        .filter((doc) => !archivedAt(doc))
        .filter((doc) => doc.extracted_data && Object.keys(doc.extracted_data).length > 0)
        .map((doc) => ({
            id: doc.id,
            originalName: doc.original_name,
            data: doc.extracted_data as CocData,
            confidences: doc.uncertainties?.confidences as Record<string, number> | undefined,
            calculatedFields: Array.isArray(doc.uncertainties?.calculatedFields)
                ? doc.uncertainties.calculatedFields.filter((field): field is string => typeof field === 'string')
                : [],
        }));

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
