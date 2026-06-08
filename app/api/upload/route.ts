import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseAdmin, sanitizeStorageName } from '../../../src/supabaseService';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/tiff',
]);

export async function POST(request: NextRequest) {
    const supabase = getSupabaseAdmin();
    const formData = await request.formData();
    const files = formData
        .getAll('files')
        .filter((value): value is File => value instanceof File && value.size > 0);
    const fallbackFile = formData.get('file');
    const uploadedBy = formData.get('uploadedBy');
    const allowDuplicateTestRun = formData.get('allowDuplicateTestRun') === 'on';

    if (files.length === 0 && fallbackFile instanceof File && fallbackFile.size > 0) {
        files.push(fallbackFile);
    }

    if (files.length === 0) {
        return NextResponse.json({ message: 'At least one file is required' }, { status: 400 });
    }

    const invalidFile = files.find((file) => !ALLOWED_MIME_TYPES.has(file.type));
    if (invalidFile) {
        return NextResponse.json({ message: `Unsupported file type: ${invalidFile.name} (${invalidFile.type})` }, { status: 400 });
    }

    const uploadedIds: string[] = [];
    const duplicates: { name: string; existingId: string }[] = [];
    const uploadedByValue = typeof uploadedBy === 'string' && uploadedBy.trim() ? uploadedBy.trim() : null;

    for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileHash = createHash('sha256').update(buffer).digest('hex');

        const { data: existingDocs, error: duplicateCheckError } = await supabase
            .from('documents')
            .select('id, original_name, file_size, uncertainties')
            .limit(500);

        if (duplicateCheckError) {
            return NextResponse.json({ ids: uploadedIds, message: duplicateCheckError.message }, { status: 500 });
        }

        const existing = existingDocs?.find((doc: any) => {
            const uncertainties = doc.uncertainties || {};
            const sameHash = uncertainties.fileHash === fileHash;
            const sameLegacyFile = doc.original_name === file.name && Number(doc.file_size) === file.size;
            return sameHash || sameLegacyFile;
        });

        if (existing && !allowDuplicateTestRun) {
            duplicates.push({ name: file.name, existingId: existing.id });
            continue;
        }

        const { data: inserted, error: insertError } = await supabase
            .from('documents')
            .insert({
                original_name: file.name,
                mime_type: file.type,
                file_size: file.size,
                uncertainties: {
                    fileHash,
                    duplicateOf: existing?.id || null,
                    testRun: allowDuplicateTestRun,
                },
                uploaded_by: uploadedByValue,
                status: 'new',
            })
            .select('id')
            .single();

        if (insertError || !inserted) {
            return NextResponse.json({ ids: uploadedIds, message: insertError?.message || 'Failed to create document' }, { status: 500 });
        }

        const storagePath = `${inserted.id}/${sanitizeStorageName(file.name)}`;
        const { error: uploadError } = await supabase.storage
            .from('coc-documents')
            .upload(storagePath, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            await supabase
                .from('documents')
                .update({ status: 'error', error_message: uploadError.message })
                .eq('id', inserted.id);
            return NextResponse.json({ ids: uploadedIds, failedId: inserted.id, message: uploadError.message }, { status: 500 });
        }

        await supabase
            .from('documents')
            .update({ file_path: storagePath })
            .eq('id', inserted.id);

        uploadedIds.push(inserted.id);
    }

    if (uploadedIds.length === 0 && duplicates.length > 0) {
        return NextResponse.json(
            { ids: [], count: 0, duplicates, message: 'Alle Dateien sind bereits in der aktiven Liste vorhanden.' },
            { status: 409 }
        );
    }

    return NextResponse.json({ ids: uploadedIds, id: uploadedIds[0], count: uploadedIds.length, duplicates });
}
