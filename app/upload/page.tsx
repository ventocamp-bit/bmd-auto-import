'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'idle' | 'uploading' | 'processing';

export default function UploadPage() {
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('idle');
    const [error, setError] = useState<string | null>(null);
    const [selectedCount, setSelectedCount] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [totalToProcess, setTotalToProcess] = useState(0);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setProcessedCount(0);
        setTotalToProcess(0);
        setPhase('uploading');

        const formData = new FormData(event.currentTarget);
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok) {
            setPhase('idle');
            setError(uploadResult.message || 'Upload fehlgeschlagen');
            return;
        }

        setPhase('processing');

        const uploadedIds = Array.isArray(uploadResult.ids) ? uploadResult.ids : [];
        const duplicateCount = Array.isArray(uploadResult.duplicates) ? uploadResult.duplicates.length : 0;
        setTotalToProcess(uploadedIds.length);

        if (uploadedIds.length === 0) {
            setPhase('idle');
            setError(duplicateCount > 0 ? 'Diese Datei ist bereits in der aktiven Liste vorhanden.' : 'Keine neue Datei hochgeladen.');
            return;
        }

        for (let index = 0; index < uploadedIds.length; index++) {
            const id = uploadedIds[index];
            const processResponse = await fetch('/api/process-pending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id] }),
            });

            if (!processResponse.ok) {
                const processResult = await processResponse.json().catch(() => ({}));
                setPhase('idle');
                setError(processResult.error || 'Verarbeitung fehlgeschlagen');
                return;
            }

            setProcessedCount(index + 1);
        }

        setPhase('idle');
        setSelectedCount(0);
        setProcessedCount(0);
        setTotalToProcess(0);

        if (uploadResult.count === 1 && uploadResult.id) {
            router.push(`/documents/${uploadResult.id}`);
            return;
        }

        router.push('/');
    }

    const busy = phase !== 'idle';
    const buttonText = phase === 'uploading'
        ? 'Upload läuft'
        : phase === 'processing'
            ? `Wird verarbeitet ${processedCount}/${totalToProcess || selectedCount}`
            : 'Hochladen und verarbeiten';
    const progressTotal = totalToProcess || selectedCount;
    const progressPercent = progressTotal > 0 ? Math.round((processedCount / progressTotal) * 100) : 0;

    return (
        <>
            <div className="header-row">
                <div>
                    <h1>Upload</h1>
                    <p>PDFs und Bilder werden gespeichert und direkt verarbeitet.</p>
                </div>
            </div>

            <section className="panel form">
                <form className="form" onSubmit={onSubmit}>
                    <div className="field">
                        <label htmlFor="files">COC Dokumente</label>
                        <input
                            id="files"
                            name="files"
                            type="file"
                            accept="application/pdf,image/*"
                            multiple
                            required
                            disabled={busy}
                            onChange={(event) => setSelectedCount(event.currentTarget.files?.length || 0)}
                        />
                        <p>{selectedCount === 0 ? 'Keine Dateien ausgewählt.' : `${selectedCount} Datei(en) ausgewählt.`}</p>
                    </div>
                    <div className="field">
                        <label htmlFor="uploadedBy">Hochgeladen von</label>
                        <input id="uploadedBy" name="uploadedBy" type="text" placeholder="Name oder Team" disabled={busy} />
                    </div>
                    <label className="checkbox-row" htmlFor="allowDuplicateTestRun">
                        <input
                            id="allowDuplicateTestRun"
                            name="allowDuplicateTestRun"
                            type="checkbox"
                            disabled={busy}
                        />
                        <span>Duplikate als neuen Testlauf zulassen</span>
                    </label>
                    {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}
                    {phase === 'processing' ? (
                        <div className="progress-block">
                            <div className="progress-meta">
                                <span>{processedCount} von {progressTotal} Dokumenten verarbeitet.</span>
                                <span>{progressPercent}%</span>
                            </div>
                            <div className="progress-track" aria-label="Verarbeitungsfortschritt">
                                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>
                    ) : null}
                    <button className="primary" type="submit" disabled={busy}>
                        {buttonText}
                    </button>
                </form>
            </section>
        </>
    );
}

