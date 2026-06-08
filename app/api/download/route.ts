import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    const format = request.nextUrl.searchParams.get('format');

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

    const bytes = Buffer.from(await fileBlob.arrayBuffer());
    const filename = storagePath.split('/').pop() || `coc-export.${format}`;

    return new NextResponse(bytes, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
