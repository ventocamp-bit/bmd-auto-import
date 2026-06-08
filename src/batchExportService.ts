import { CocData } from './geminiService';
import { DocumentRecord } from './supabaseService';

export type BatchExportDocument = {
    id: string;
    originalName: string;
    data: CocData;
    confidences?: Record<string, number>;
    calculatedFields?: string[];
};

function archivedAt(doc: DocumentRecord) {
    const value = doc.uncertainties?.archivedAt;
    return typeof value === 'string' ? value : null;
}

function dedupeKey(doc: DocumentRecord) {
    const data = doc.extracted_data as Record<string, unknown>;
    const fin = typeof data?.FIN === 'string' ? data.FIN.trim().toUpperCase() : '';
    const manufacturer = typeof data?.MARKE === 'string'
        ? data.MARKE.trim().toUpperCase()
        : typeof data?.Marke === 'string'
            ? data.Marke.trim().toUpperCase()
            : '';
    const fileHash = typeof doc.uncertainties?.fileHash === 'string' ? doc.uncertainties.fileHash : '';

    return fin ? `${manufacturer}:${fin}` : fileHash || doc.id;
}

export function buildBatchExportDocuments(records: DocumentRecord[]): BatchExportDocument[] {
    const latestByKey = new Map<string, DocumentRecord>();

    for (const doc of records) {
        if (archivedAt(doc) || !doc.extracted_data || Object.keys(doc.extracted_data).length === 0) {
            continue;
        }

        const key = dedupeKey(doc);
        const existing = latestByKey.get(key);
        const existingTime = existing ? new Date(existing.processed_at || existing.updated_at || existing.created_at).getTime() : 0;
        const currentTime = new Date(doc.processed_at || doc.updated_at || doc.created_at).getTime();

        if (!existing || currentTime >= existingTime) {
            latestByKey.set(key, doc);
        }
    }

    return [...latestByKey.values()]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((doc) => ({
            id: doc.id,
            originalName: doc.original_name,
            data: doc.extracted_data as CocData,
            confidences: doc.uncertainties?.confidences as Record<string, number> | undefined,
            calculatedFields: Array.isArray(doc.uncertainties?.calculatedFields)
                ? doc.uncertainties.calculatedFields.filter((field): field is string => typeof field === 'string')
                : [],
        }));
}
