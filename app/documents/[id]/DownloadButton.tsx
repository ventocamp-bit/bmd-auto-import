'use client';

import { useState } from 'react';

interface DownloadButtonProps {
    href: string;
    label: string;
    documentId: string;
}

export function DownloadButton({ href, label }: DownloadButtonProps) {
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedPath, setSavedPath] = useState<string | null>(null);

    async function download() {
        setError(null);
        setSavedPath(null);
        setDownloading(true);

        try {
            const response = await fetch(href);

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || `Download failed with ${response.status}`);
            }

            const blob = await response.blob();
            const disposition = response.headers.get('content-disposition') || '';
            const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'coc-export.csv';
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setSavedPath(filename);
        } catch (downloadError) {
            setError(downloadError instanceof Error ? downloadError.message : String(downloadError));
        } finally {
            setDownloading(false);
        }
    }

    return (
        <span className="download-inline">
            <button className="primary" type="button" onClick={download} disabled={downloading}>
                {downloading ? 'Lädt herunter' : label}
            </button>
            {savedPath ? <span className="download-status">Download gestartet: {savedPath}</span> : null}
            {error ? <a className="button" href={href}>Direkt öffnen</a> : null}
        </span>
    );
}
