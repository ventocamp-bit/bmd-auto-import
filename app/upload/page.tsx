'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'idle' | 'uploading' | 'processing';

export default function UploadPage() {
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('idle');
    const [error, setError] = useState<string | null>(null);
    const [selectedCount, setSelectedCount] = useState(0);
    const [uploadedCount, setUploadedCount] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [totalToProcess, setTotalToProcess] = useState(0);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setUploadedCount(0);
        setProcessedCount(0);
        setTotalToProcess(0);
        setPhase('uploading');

        const form = event.currentTarget;
        const fileInput = form.elements.namedItem('files') as HTMLInputElement | null;
        const uploadedByInput = form.elements.namedItem('uploadedBy') as HTMLInputElement | null;
        const allowDuplicateInput = form.elements.namedItem('allowDuplicateTestRun') as HTMLInputElement | null;
        const files = Array.from(fileInput?.files || []);

        if (files.length === 0) {
            setPhase('idle');
            setError('Bitte mindestens eine Datei auswählen.');
            return;
        }

        const uploadedIds: string[] = [];
        let duplicateCount = 0;

        for (let index = 0; index < files.length; index++) {
            const fileFormData = new FormData();
            fileFormData.append('files', files[index]);
            if (uploadedByInput?.value) {
                fileFormData.append('uploadedBy', uploadedByInput.value);
            }
            if (allowDuplicateInput?.checked) {
                fileFormData.append('allowDuplicateTestRun', 'on');
            }

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: fileFormData,
            });

            const uploadResult = await uploadResponse.json().catch(() => ({}));

            if (!uploadResponse.ok && uploadResponse.status !== 409) {
                setPhase('idle');
                setError(uploadResult.message || `Upload fehlgeschlagen bei Datei ${index + 1}/${files.length}`);
                return;
            }

            if (Array.isArray(uploadResult.ids)) {
                uploadedIds.push(...uploadResult.ids);
            }
            duplicateCount += Array.isArray(uploadResult.duplicates) ? uploadResult.duplicates.length : 0;
            setUploadedCount(index + 1);
        }

        setPhase('processing');

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
        setUploadedCount(0);
        setProcessedCount(0);
        setTotalToProcess(0);

        if (uploadedIds.length === 1) {
            router.push(`/documents/${uploadedIds[0]}`);
            return;
        }

        router.push('/');
    }

    const busy = phase !== 'idle';
    const buttonText = phase === 'uploading'
        ? `Upload läuft ${uploadedCount}/${selectedCount}`
        : phase === 'processing'
            ? `Wird verarbeitet ${processedCount}/${totalToProcess || selectedCount}`
            : 'Hochladen und verarbeiten';
    const progressTotal = phase === 'uploading' ? selectedCount : totalToProcess || selectedCount;
    const progressCurrent = phase === 'uploading' ? uploadedCount : processedCount;
    const progressPercent = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

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
                    {phase !== 'idle' ? (
                        <div className="progress-block">
                            <div className="progress-meta">
                                <span>
                                    {phase === 'uploading'
                                        ? `${uploadedCount} von ${progressTotal} Dokumenten hochgeladen.`
                                        : `${processedCount} von ${progressTotal} Dokumenten verarbeitet.`}
                                </span>
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

