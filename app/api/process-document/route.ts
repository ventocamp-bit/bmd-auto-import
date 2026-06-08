import { NextRequest, NextResponse } from 'next/server';
import { ExcelService } from '../../../src/excelService';
import {
    COC_EXTRACTION_PROMPT_VERSION,
    CocData,
    GDB_FIELD_KEYS,
    GeminiService,
    repairCocDataWithOcr,
} from '../../../src/geminiService';
import { DocumentRecord, getSupabaseAdmin, sanitizeStorageName } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CONFIDENCE_REVIEW_THRESHOLD = 0.85;

function getMissingFields(data: Partial<CocData>) {
    return ['FIN', 'Aussteller', 'Marke', 'Typ'].filter((key) => {
        const value = data[key as keyof CocData];
        return typeof value !== 'string' || value.trim().length === 0;
    });
}

function getLowConfidenceFields(data: Partial<CocData>, confidences: Partial<Record<keyof CocData, number>>) {
    return ([...GDB_FIELD_KEYS] as (keyof CocData)[]).filter((key) => {
        const confidence = confidences[key];
        const value = data[key];
        return Boolean(value) && (typeof confidence !== 'number' || confidence < CONFIDENCE_REVIEW_THRESHOLD);
    });
}

async function getDocumentId(request: NextRequest) {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const id = formData.get('id');
        return typeof id === 'string' ? id : null;
    }

    try {
        const body = await request.json();
        return typeof body.id === 'string' ? body.id : null;
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    const id = await getDocumentId(request);
    if (!id) {
        return NextResponse.json({ message: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const redirectToDetail = () => NextResponse.redirect(new URL(`/documents/${id}`, request.url), 303);
    const wantsRedirect = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || false;

    try {
        const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
        if (error || !data) {
            return NextResponse.json({ message: error?.message || 'Document not found' }, { status: 404 });
        }

        const doc = data as DocumentRecord;
        const existingUncertainties = doc.uncertainties || {};
        if (!doc.file_path) {
            return NextResponse.json({ message: 'Document has no file_path' }, { status: 400 });
        }

        await supabase
            .from('documents')
            .update({ status: 'processing', error_message: null })
            .eq('id', id);

        const { data: fileBlob, error: downloadError } = await supabase.storage
            .from('coc-documents')
            .download(doc.file_path);

        if (downloadError || !fileBlob) {
            throw new Error(downloadError?.message || 'Failed to download document');
        }

        const buffer = Buffer.from(await fileBlob.arrayBuffer());
        const geminiService = new GeminiService();
        let extraction;

        try {
            extraction = await geminiService.extractDataWithConfidenceFromDocument(buffer, doc.mime_type);
        } catch (error) {
            const existingOcrText = typeof existingUncertainties.ocrText === 'string' ? existingUncertainties.ocrText : '';
            const existingData = doc.extracted_data as CocData | null;

            if (!existingOcrText || !existingData || Object.keys(existingData).length === 0) {
                throw error;
            }

            console.error('[process-document] Gemini failed, repairing from existing OCR:', error instanceof Error ? error.message : String(error));
            const repaired = repairCocDataWithOcr(
                { ...existingData },
                { ...((existingUncertainties.confidences as Record<string, number> | undefined) || {}) },
                existingOcrText
            );
            extraction = {
                data: repaired.data,
                confidences: repaired.confidences,
                raw: existingUncertainties.raw || null,
                ocrText: existingOcrText,
                promptVersion: COC_EXTRACTION_PROMPT_VERSION,
                calculatedFields: repaired.calculatedFields,
            };
        }

        const extractedData = extraction.data;
        const lowConfidenceFields = getLowConfidenceFields(extractedData, extraction.confidences);
        const missingFields = getMissingFields(extractedData);
        const shouldReview = missingFields.length > 0 || lowConfidenceFields.length > 0;

        if (shouldReview) {
            await supabase
                .from('documents')
                .update({
                    status: 'review',
                    manufacturer: extractedData.Marke || null,
                    extracted_data: extractedData,
                    uncertainties: {
                        ...existingUncertainties,
                        missingFields,
                        lowConfidenceFields,
                        confidences: extraction.confidences,
                        raw: extraction.raw,
                        ocrText: extraction.ocrText,
                        promptVersion: extraction.promptVersion,
                        calculatedFields: extraction.calculatedFields,
                    },
                    processed_at: new Date().toISOString(),
                })
                .eq('id', id);

            return wantsRedirect
                ? redirectToDetail()
                : NextResponse.json({ id, status: 'review', missingFields });
        }

        const excelService = new ExcelService();
        const csvBuffer = excelService.generateCsvBuffer(extractedData);
        const csvExportName = `${sanitizeStorageName(extractedData.FIN)}_BMD_Import.csv`;
        const csvExportPath = `${id}/${csvExportName}`;

        const { error: csvUploadError } = await supabase.storage
            .from('coc-exports')
            .upload(csvExportPath, csvBuffer, {
                contentType: 'text/csv; charset=utf-8',
                upsert: true,
            });

        if (csvUploadError) {
            throw new Error(csvUploadError.message);
        }

        await supabase
            .from('documents')
            .update({
                status: 'success',
                manufacturer: extractedData.Marke,
                extracted_data: extractedData,
                uncertainties: {
                    ...existingUncertainties,
                    confidences: extraction.confidences,
                    csvExportPath,
                    ocrText: extraction.ocrText,
                    promptVersion: extraction.promptVersion,
                    calculatedFields: extraction.calculatedFields,
                },
                export_path: csvExportPath,
                processed_at: new Date().toISOString(),
            })
            .eq('id', id);

        return wantsRedirect
            ? redirectToDetail()
            : NextResponse.json({ id, status: 'success', exportPath: csvExportPath });
    } catch (error: any) {
        await supabase
            .from('documents')
            .update({ status: 'error', error_message: error.message })
            .eq('id', id);

        return wantsRedirect
            ? redirectToDetail()
            : NextResponse.json({ id, status: 'error', message: error.message }, { status: 500 });
    }
}
