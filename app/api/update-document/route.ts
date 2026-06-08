import { NextRequest, NextResponse } from 'next/server';
import { ExcelService } from '../../../src/excelService';
import { CocData, GDB_FIELD_KEYS } from '../../../src/geminiService';
import { getSupabaseAdmin, sanitizeStorageName } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readField(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
    console.log('[update-document] route entered');
    const isFormPost = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded')
        || (request.headers.get('content-type') || '').includes('multipart/form-data');

    try {
        console.log('[update-document] parsing formData');
        const formData = await request.formData();
        console.log('[update-document] formData entries:', [...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : `[File:${value.name}]`]));

        const id = formData.get('id');
        console.log('[update-document] id:', id);

        if (typeof id !== 'string' || !id) {
            console.error('[update-document] missing id');
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        const corrections = GDB_FIELD_KEYS.reduce((result, key) => {
            result[key] = readField(formData, key);
            return result;
        }, {} as CocData);
        corrections.Aussteller = corrections.AUSST_GENDOK || '';
        corrections.Marke = corrections.MARKE || '';
        corrections.Typ = corrections.TYPE || '';
        console.log('[update-document] correction keys:', Object.keys(corrections));

        const missingFields = ['FIN', 'AUSST_GENDOK', 'MARKE', 'TYPE']
            .map((key) => [key, corrections[key]] as const)
            .filter(([, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            console.error('[update-document] missing fields:', missingFields);
            return NextResponse.json({ error: 'Missing fields', missingFields }, { status: 400 });
        }

        console.log('[update-document] creating supabase admin client');
        const supabase = getSupabaseAdmin();

        console.log('[update-document] fetching document');
        const { data: document, error: fetchError } = await supabase
            .from('documents')
            .select('id, extracted_data, uncertainties')
            .eq('id', id)
            .single();

        if (fetchError || !document) {
            console.error('[update-document] document fetch failed:', fetchError);
            return NextResponse.json({ error: 'Document fetch failed', detail: fetchError?.message }, { status: 404 });
        }

        const correctedData: CocData = {
            ...((document.extracted_data as Record<string, string> | null) || {}),
            ...corrections,
        };
        console.log('[update-document] correctedData keys:', Object.keys(correctedData));

        console.log('[update-document] creating ExcelService');
        const excelService = new ExcelService();

        console.log('[update-document] generating csv buffer');
        const csvBuffer = excelService.generateCsvBuffer(correctedData);
        console.log('[update-document] csv buffer length:', csvBuffer.length);

        const csvExportName = `${sanitizeStorageName(correctedData.FIN)}_BMD_Import.csv`;
        const csvExportPath = `${id}/${csvExportName}`;
        console.log('[update-document] csv export path:', csvExportPath);

        console.log('[update-document] uploading csv export');
        const { error: csvUploadError } = await supabase.storage
            .from('coc-exports')
            .upload(csvExportPath, csvBuffer, {
                contentType: 'text/csv; charset=utf-8',
                upsert: true,
            });

        if (csvUploadError) {
            console.error('[update-document] csv upload failed:', csvUploadError);
            return NextResponse.json({ error: 'CSV upload failed', detail: csvUploadError.message }, { status: 500 });
        }

        console.log('[update-document] updating document row');
        const { error: updateError } = await supabase
            .from('documents')
            .update({
                status: 'success',
                manufacturer: correctedData.Marke,
                extracted_data: correctedData,
                uncertainties: {
                    ...((document.uncertainties as Record<string, unknown> | null) || {}),
                    confidences: GDB_FIELD_KEYS.reduce((result, key) => {
                        result[key] = 1;
                        return result;
                    }, {
                        Aussteller: 1,
                        Marke: 1,
                        Typ: 1,
                    } as Record<string, number>),
                    csvExportPath,
                },
                error_message: null,
                export_path: csvExportPath,
                processed_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (updateError) {
            console.error('[update-document] db update failed:', updateError);
            return NextResponse.json({ error: 'DB update failed', detail: updateError.message }, { status: 500 });
        }

        console.log('[update-document] success');
        if (isFormPost) {
            return NextResponse.redirect(new URL(`/documents/${id}`, request.url), 303);
        }

        return NextResponse.json({ ok: true, id, exportPath: csvExportPath, csvExportPath });
    } catch (error) {
        console.error('[update-document] FATAL', error);

        if (error instanceof Error) {
            console.error('[update-document] name:', error.name);
            console.error('[update-document] message:', error.message);
            console.error('[update-document] stack:', error.stack);
        }

        return NextResponse.json(
            {
                error: 'update-document failed',
                message: error instanceof Error ? error.message : String(error),
                stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}
