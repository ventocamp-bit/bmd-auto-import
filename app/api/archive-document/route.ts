import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getDocumentId(request: NextRequest) {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const id = formData.get('id');
        return typeof id === 'string' ? id : null;
    }

    const body = await request.json().catch(() => ({}));
    return typeof body.id === 'string' ? body.id : null;
}

export async function POST(request: NextRequest) {
    const id = await getDocumentId(request);

    if (!id) {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('uncertainties')
        .eq('id', id)
        .single();

    if (fetchError || !document) {
        return NextResponse.json({ error: fetchError?.message || 'Document not found' }, { status: 404 });
    }

    const { error } = await supabase
        .from('documents')
        .update({
            uncertainties: {
                ...((document.uncertainties as Record<string, unknown> | null) || {}),
                archivedAt: new Date().toISOString(),
            },
        })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const wantsRedirect = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
    return wantsRedirect
        ? NextResponse.redirect(new URL('/', request.url), 303)
        : NextResponse.json({ ok: true, id });
}
