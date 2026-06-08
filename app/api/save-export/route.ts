import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { getSupabaseAdmin } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';
    const format = body.format;

    if (!id || format !== 'csv') {
        return NextResponse.json({ error: 'id and format=csv are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: doc, error } = await supabase
        .from('documents')
        .select('export_path, uncertainties')
        .eq('id', id)
        .single();

    if (error || !doc?.export_path) {
        return NextResponse.json({ error: error?.message || 'Export not found' }, { status: 404 });
    }

    const csvExportPath = typeof doc.uncertainties?.csvExportPath === 'string'
        ? doc.uncertainties.csvExportPath
        : doc.export_path;
    const storagePath = csvExportPath;
    const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('coc-exports')
        .download(storagePath);

    if (downloadError || !fileBlob) {
        return NextResponse.json({ error: downloadError?.message || 'File not found' }, { status: 404 });
    }

    const filename = storagePath.split('/').pop() || `coc-export.${format}`;
    const downloadsDir = join(homedir(), 'Downloads');
    const outputPath = join(downloadsDir, filename);

    await mkdir(downloadsDir, { recursive: true });
    await writeFile(outputPath, Buffer.from(await fileBlob.arrayBuffer()));

    return NextResponse.json({ ok: true, path: outputPath, filename });
}
