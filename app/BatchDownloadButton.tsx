'use client';

import { useState } from 'react';

export function BatchDownloadButton({ disabled }: { disabled: boolean }) {
    const [saving, setSaving] = useState(false);
    const [savedPath, setSavedPath] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function saveBatch() {
        setSaving(true);
        setSavedPath(null);
        setError(null);

        try {
            const response = await fetch('/api/download-batch');

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || `Download failed with ${response.status}`);
            }

            const blob = await response.blob();
            const disposition = response.headers.get('content-disposition') || '';
            const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'BMD_Sammelimport.xlsx';
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setSavedPath(filename);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : String(saveError));
        } finally {
            setSaving(false);
        }
    }

    return (
        <span className="download-inline">
            <button type="button" onClick={saveBatch} disabled={disabled || saving}>
                {saving ? 'Lädt herunter' : 'Sammel-Excel herunterladen'}
            </button>
            {savedPath ? <span className="download-status">Download gestartet: {savedPath}</span> : null}
            {error ? <a className="button" href="/api/download-batch">Direkt öffnen</a> : null}
        </span>
    );
}
