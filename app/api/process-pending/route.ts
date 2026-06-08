import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../src/supabaseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BATCH_SIZE = 1;

async function getRequestedIds(request: NextRequest) {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        const body = await request.json().catch(() => ({}));
        return Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0) : [];
    }

    return [];
}

export async function POST(request: NextRequest) {
    const supabase = getSupabaseAdmin();
    const requestedIds = await getRequestedIds(request);
    let query = supabase
        .from('documents')
        .select('id')
        .eq('status', 'new')
        .order('created_at', { ascending: true })
        .limit(MAX_BATCH_SIZE);

    if (requestedIds.length > 0) {
        query = query.in('id', requestedIds.slice(0, MAX_BATCH_SIZE));
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = [];

    for (const doc of data || []) {
        const response = await fetch(new URL('/api/process-document', request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: doc.id }),
        });
        const result = await response.json().catch(() => ({}));
        results.push({ id: doc.id, status: response.status, result });
    }

    const wantsRedirect = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');

    if (wantsRedirect) {
        return NextResponse.redirect(new URL('/', request.url), 303);
    }

    return NextResponse.json({ processed: results.length, results });
}
