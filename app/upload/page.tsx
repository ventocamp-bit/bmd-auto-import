'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'idle' | 'running';

type ProcessAttemptResult = {
    ok: boolean;
    message?: string;
};

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function readableMessage(value: unknown) {
    if (!value) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export default function UploadPage() {
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('idle');
    const [error, setError] = useState<string | null>(null);
    const [selectedCount, setSelectedCount] = useState(0);
    const [uploadedCount, setUploadedCount] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [totalToProcess, setTotalToProcess] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [duplicateCount, setDuplicateCount] = useState(0);
    const [currentStep, setCurrentStep] = useState('');
    const [currentFileName, setCurrentFileName] = useState('');

    async function processDocumentWithRetry(id: string): Promise<ProcessAttemptResult> {
        let lastMessage = 'Verarbeitung fehlgeschlagen';
        const retryDelays = [3000, 8000, 15000, 30000];

        for (let attempt = 1; attempt <= retryDelays.length + 1; attempt++) {
            const processResponse = await fetch('/api/process-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            const processResult = await processResponse.json().catch(() => ({}));

            if (processResponse.ok) {
                return { ok: true };
            }

            lastMessage = readableMessage(processResult.error)
                || readableMessage(processResult.message)
                || lastMessage;

            if (attempt <= retryDelays.length) {
                setCurrentStep(`Retry ${attempt}/${retryDelays.length} nach Gemini-Fehler`);
                await wait(retryDelays[attempt - 1]);
            }
        }

        return { ok: false, message: lastMessage };
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setUploadedCount(0);
        setProcessedCount(0);
        setTotalToProcess(0);
        setFailedCount(0);
        setDuplicateCount(0);
        setCurrentStep('');
        setCurrentFileName('');
        setPhase('running');

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

        setTotalToProcess(files.length);

        const completedIds: string[] = [];
        let failedTotal = 0;
        let duplicateTotal = 0;

        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            setCurrentFileName(file.name);
            setCurrentStep(`Upload ${index + 1}/${files.length}`);

            const fileFormData = new FormData();
            fileFormData.append('files', file);
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

            if (uploadResponse.status === 409) {
                duplicateTotal += Array.isArray(uploadResult.duplicates) ? uploadResult.duplicates.length : 1;
                setDuplicateCount(duplicateTotal);
                setProcessedCount(index + 1);
                continue;
            }

            if (!uploadResponse.ok) {
                failedTotal += 1;
                setFailedCount(failedTotal);
                setProcessedCount(index + 1);
                setError(uploadResult.message || `Upload fehlgeschlagen bei Datei ${index + 1}/${files.length}. Datei wurde übersprungen.`);
                continue;
            }

            const uploadedId = Array.isArray(uploadResult.ids) ? uploadResult.ids[0] : null;
            duplicateTotal += Array.isArray(uploadResult.duplicates) ? uploadResult.duplicates.length : 0;
            setDuplicateCount(duplicateTotal);
            setUploadedCount(index + 1);

            if (!uploadedId) {
                failedTotal += 1;
                setFailedCount(failedTotal);
                setProcessedCount(index + 1);
                setError(`Upload ohne Dokument-ID bei Datei ${index + 1}/${files.length}. Datei wurde übersprungen.`);
                continue;
            }

            setCurrentStep(`Verarbeitung ${index + 1}/${files.length}`);
            const processResult = await processDocumentWithRetry(uploadedId);
            if (processResult.ok) {
                completedIds.push(uploadedId);
            } else {
                failedTotal += 1;
                setFailedCount(failedTotal);
                setError(`${file.name}: ${processResult.message || 'Verarbeitung fehlgeschlagen'}`);
            }
            setProcessedCount(index + 1);
        }

        setPhase('idle');
        setSelectedCount(0);
        setUploadedCount(0);
        setProcessedCount(0);
        setTotalToProcess(0);

        setCurrentStep('');
        setCurrentFileName('');

        if (completedIds.length === 0) {
            setError(duplicateTotal > 0
                ? 'Keine neuen Dateien verarbeitet. Duplikate wurden übersprungen.'
                : 'Keine Datei konnte verarbeitet werden.');
            return;
        }

        if (completedIds.length === 1 && failedTotal === 0 && duplicateTotal === 0) {
            router.push(`/documents/${completedIds[0]}`);
            return;
        }

        router.push('/');
    }

    const busy = phase !== 'idle';
    const buttonText = phase === 'running'
        ? `${currentStep || 'Wird verarbeitet'}`
        : 'Hochladen und verarbeiten';
    const progressTotal = totalToProcess || selectedCount;
    const progressCurrent = processedCount;
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
                                    {processedCount} von {progressTotal} Dokumenten abgeschlossen.
                                </span>
                                <span>{progressPercent}%</span>
                            </div>
                            <div className="progress-track" aria-label="Verarbeitungsfortschritt">
                                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <p>
                                {currentFileName ? `Aktuell: ${currentFileName}` : null}
                                {uploadedCount > 0 ? ` | Hochgeladen: ${uploadedCount}` : null}
                                {failedCount > 0 ? ` | Fehler: ${failedCount}` : null}
                                {duplicateCount > 0 ? ` | Duplikate: ${duplicateCount}` : null}
                            </p>
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

