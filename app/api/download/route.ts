import { NextRequest, NextResponse } from 'next/server';
import { ExcelService } from '../../../src/excelService';
import { getSupabaseAdmin } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    const format = request.nextUrl.searchParams.get('format');

    if (!id || !['csv', 'xlsx'].includes(format || '')) {
        return NextResponse.json({ error: 'id and format=csv|xlsx are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (format === 'xlsx') {
        const { data: doc, error } = await supabase
            .from('documents')
            .select('original_name, extracted_data')
            .eq('id', id)
            .single();

        if (error || !doc?.extracted_data) {
            return NextResponse.json({ error: error?.message || 'Extracted data not found' }, { status: 404 });
        }

        const excelService = new ExcelService();
        const bytes = excelService.generateAuthorityXlsxBuffer(doc.extracted_data as any);
        const fin = typeof (doc.extracted_data as any).FIN === 'string' && (doc.extracted_data as any).FIN.trim()
            ? (doc.extracted_data as any).FIN.trim()
            : doc.original_name.replace(/\.[^.]+$/, '');

        return new NextResponse(new Uint8Array(bytes), {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fin}_Behoerdenimport.xlsx"`,
            },
        });
    }

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
