import { NextResponse } from 'next/server';
import { buildBatchExportDocuments } from '../../../src/batchExportService';
import { ExcelService } from '../../../src/excelService';
import { DocumentRecord, getSupabaseAdmin } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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

    return new NextResponse(new Uint8Array(bytes), {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="BMD_Sammelimport_${date}.xlsx"`,
        },
    });
}
