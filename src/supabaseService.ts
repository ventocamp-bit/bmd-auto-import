import 'server-only';
import { createClient } from '@supabase/supabase-js';

export type DocumentStatus = 'new' | 'processing' | 'review' | 'success' | 'error';

export interface DocumentRecord {
    id: string;
    user_id: string | null;
    original_name: string;
    mime_type: string;
    file_path: string | null;
    file_size: number | null;
    status: DocumentStatus;
    manufacturer: string | null;
    extracted_data: Record<string, unknown>;
    uncertainties: Record<string, unknown>;
    error_message: string | null;
    export_path: string | null;
    uploaded_by: string | null;
    created_at: string;
    updated_at: string;
    processed_at: string | null;
}

export function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

export function sanitizeStorageName(name: string): string {
    return name
        .normalize('NFKD')
        .replace(/[^\w.\-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120) || 'document';
}
