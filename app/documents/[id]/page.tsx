import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COC_EXTRACTION_PROMPT_VERSION, GDB_FIELD_KEYS } from '../../../src/geminiService';
import { getSupabaseAdmin, DocumentRecord } from '../../../src/supabaseService';
import { DownloadButton } from './DownloadButton';

export const dynamic = 'force-dynamic';

const REQUIRED_FIELDS = ['FIN', 'AUSST_GENDOK', 'MARKE', 'TYPE'];

async function getDocument(id: string) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();

    if (error || !data) {
        return null;
    }

    const doc = data as DocumentRecord;
    const fileUrl = doc.file_path
        ? await supabase.storage.from('coc-documents').createSignedUrl(doc.file_path, 60 * 30)
        : null;

    return {
        doc,
        fileUrl: fileUrl?.data?.signedUrl || null,
        xlsxExportUrl: doc.extracted_data ? `/api/download?id=${doc.id}&format=xlsx` : null,
    };
}

function confidenceFor(uncertainties: Record<string, any>, key: string) {
    const value = uncertainties?.confidences?.[key];
    return typeof value === 'number' ? value : null;
}

function isUncertain(uncertainties: Record<string, any>, key: string) {
    const lowConfidence = Array.isArray(uncertainties?.lowConfidenceFields) && uncertainties.lowConfidenceFields.includes(key);
    const missing = Array.isArray(uncertainties?.missingFields) && uncertainties.missingFields.includes(key);
    const confidence = confidenceFor(uncertainties, key);
    return missing || lowConfidence || (typeof confidence === 'number' && confidence < 0.85);
}

function confidenceLabel(confidence: number | null) {
    if (confidence === null) {
        return 'Confidence: nicht bewertet';
    }

    return `Confidence: ${Math.round(confidence * 100)}%`;
}

const FIELD_LABELS: Record<string, string> = {
    FIN: 'Fahrzeugidentifikationsnummer',
    AUSST_GENDOK: 'Unterzeichner',
    MARKE: 'Fabrikmarke',
    TYPE: 'Typ',
    VAR: 'Variante',
    VERS: 'Version',
    HANDNAME: 'Handelsname',
    TGNR: 'Typgenehmigungsnummer',
    REVISION_GEN: 'Revision',
    DAT_GENDOK: 'Ausstellungsdatum',
    RADST_1: 'Radstand',
    RADST_2: 'Achsabstand 1-2',
    RADST_3: 'Achsabstand 2-3',
    RADST_4: 'Achsabstand 3-4',
    LAENGE: 'Länge',
    BREITE: 'Breite',
    HOEHE: 'Höhe',
    ABST_ANHVORR: 'Abstand Anhängevorrichtung',
    LADEFL_LAENGE: 'Länge Ladefläche',
    UEBERH_HINTEN: 'Hinterer Überhang',
    MASSE_FAHRB: 'Masse fahrbereit',
    VERT_ACHSE_1: 'Masse Achse 1',
    VERT_ACHSE_2: 'Masse Achse 2',
    VERT_ACHSE_3: 'Masse Achse 3',
    VERT_ACHSE_4: 'Masse Achse 4',
    VERT_STUETZ: 'Stützlast',
    TATS_FAHRZEUGMASSE: 'Tatsächliche Masse',
    HZUL_NUTZLAST: 'Nutzlast',
    HZUL_MINDEST: 'Gesamtgewicht Mindestwert',
    TECH_ZUL_MASSE: 'Technisch zulässige Gesamtmasse',
    TECH_ZUL_ACHSL_1: 'Technisch zulässige Achslast 1',
    TECH_ZUL_ACHSL_2: 'Technisch zulässige Achslast 2',
    TECH_ZUL_ACHSL_3: 'Technisch zulässige Achslast 3',
    TECH_ZUL_ACHSL_4: 'Technisch zulässige Achslast 4',
    TECH_ZUL_ACHSGR_1: 'Technisch zulässige Achsgruppe 1',
    TECH_ZUL_ACHSGR_2: 'Technisch zulässige Achsgruppe 2',
    TECH_ZUL_STUETZ: 'Technisch zulässige Stützlast',
    VMAX_GEM: 'Höchstgeschwindigkeit',
    SPURW_1: 'Spurweite Achse 1',
    SPURW_2: 'Spurweite Achse 2',
    SPURW_3: 'Spurweite Achse 3',
    RADREIFEN_ACHSE1: 'Reifen/Rad Achse 1',
    RADREIFEN_ACHSE2: 'Reifen/Rad Achse 2',
    RADREIFEN_ACHSE3: 'Reifen/Rad Achse 3',
    BER_ACHS4: 'Reifen/Rad Achse 4',
    AUFBAU_EU_C: 'Aufbau EU Code',
    AUFBAU_NAT_C: 'Aufbau nationaler Code',
    ANHVORR_GENZ: 'Genehmigungszeichen Anhängevorrichtung',
    KENNW_ANHAENGEVORR: 'Kennwerte Anhängevorrichtung',
    FARBE_C: 'Farbe',
    KUNDENNr: 'Kundennummer',
    TypSMail: 'E-Mail Einmeldebestätigung',
};

const COC_POINTS: Record<string, string> = {
    FIN: '0.10.',
    AUSST_GENDOK: '',
    MARKE: '0.1.',
    TYPE: '0.2.',
    VAR: '0.2.',
    VERS: '0.2.',
    HANDNAME: '0.2.1.',
    TGNR: '',
    REVISION_GEN: 'nicht am COC',
    DAT_GENDOK: '',
    RADST_1: '4.',
    RADST_2: '4.1.',
    RADST_3: '4.1.',
    RADST_4: '4.1.',
    LAENGE: '5.',
    BREITE: '6.',
    HOEHE: '7.',
    ABST_ANHVORR: '10.',
    LADEFL_LAENGE: '11.',
    UEBERH_HINTEN: '12.',
    MASSE_FAHRB: '13.',
    VERT_ACHSE_1: '13.1.',
    VERT_ACHSE_2: '13.1.',
    VERT_ACHSE_3: '13.1.',
    VERT_ACHSE_4: '13.1.',
    VERT_STUETZ: '13.1.',
    TATS_FAHRZEUGMASSE: '13.2.',
    HZUL_NUTZLAST: 'nicht am COC',
    HZUL_MINDEST: 'nicht am COC',
    TECH_ZUL_MASSE: '16.1.',
    TECH_ZUL_ACHSL_1: '16.2.',
    TECH_ZUL_ACHSL_2: '16.2.',
    TECH_ZUL_ACHSL_3: '16.2.',
    TECH_ZUL_ACHSL_4: '16.2.',
    TECH_ZUL_ACHSGR_1: '16.3.',
    TECH_ZUL_ACHSGR_2: '16.3.',
    TECH_ZUL_STUETZ: '19.',
    VMAX_GEM: '29.',
    SPURW_1: '30.1./30.2.',
    SPURW_2: '30.1./30.2.',
    SPURW_3: '30.1./30.2.',
    RADREIFEN_ACHSE1: '35.1.',
    RADREIFEN_ACHSE2: '35.2.',
    RADREIFEN_ACHSE3: '35.3.',
    BER_ACHS4: '35.4.',
    AUFBAU_EU_C: '38.',
    AUFBAU_NAT_C: '38.',
    ANHVORR_GENZ: '44.',
    KENNW_ANHAENGEVORR: '45.1.',
    FARBE_C: 'nicht am COC',
    KUNDENNr: 'nicht am COC',
    TypSMail: 'nicht am COC',
};

function cleanHitchCharacteristicValue(value: string) {
    const compact = value.replace(/\s+/g, ' ').trim();
    const parts: string[] = [];
    const normalized = compact.replace(/\s*\/\s*/g, '; ');

    for (const match of normalized.matchAll(/\b([DVSU])\s*[=:]\s*([^;]+)/gi)) {
        const label = match[1].toUpperCase();
        const raw = match[2].trim().replace(/^[:;\s]+|[:;\s]+$/g, '');
        if (!raw || /\.{2,}/.test(raw) || !/\d/.test(raw)) {
            continue;
        }

        parts.push(`${label}: ${raw}`);
    }

    return parts.length > 0 ? parts.join('; ') : compact;
}

function displayValue(key: string, value: unknown) {
    const text = String(value || '');
    return key === 'KENNW_ANHAENGEVORR' ? cleanHitchCharacteristicValue(text) : text;
}

function uniqueFields(fields: string[]) {
    return fields.filter((field, index) => fields.indexOf(field) === index);
}

function fieldGroups(uncertainties: Record<string, any>) {
    const uncertainFields = GDB_FIELD_KEYS.filter((key) => isUncertain(uncertainties, key));
    const requiredFields = REQUIRED_FIELDS.filter((key) => !uncertainFields.includes(key as any));
    const remainingFields = GDB_FIELD_KEYS.filter((key) => !uncertainFields.includes(key) && !requiredFields.includes(key));

    return [
        { title: 'Unsicher prüfen', fields: uniqueFields(uncertainFields) },
        { title: 'Pflichtfelder', fields: uniqueFields(requiredFields) },
        { title: 'Weitere Felder', fields: uniqueFields(remainingFields) },
    ].filter((group) => group.fields.length > 0);
}

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const result = await getDocument(id);

    if (!result) {
        notFound();
    }

    const { doc, fileUrl, xlsxExportUrl } = result;
    const extractedData = doc.extracted_data || {};
    const uncertainties = doc.uncertainties || {};
    const ocrText = typeof uncertainties.ocrText === 'string' ? uncertainties.ocrText : '';
    const promptVersion = typeof uncertainties.promptVersion === 'string' ? uncertainties.promptVersion : null;
    const promptIsCurrent = promptVersion === COC_EXTRACTION_PROMPT_VERSION;
    const groups = fieldGroups(uncertainties);

    return (
        <>
            <div className="header-row">
                <div>
                    <h1>{doc.original_name}</h1>
                    <p><span className={`status ${doc.status}`}>{doc.status}</span></p>
                </div>
                <div className="actions">
                    <Link className="button" href="/">Zurück</Link>
                    <form action="/api/process-document" method="post">
                        <input type="hidden" name="id" value={doc.id} />
                        <button className="primary" type="submit">
                            {promptIsCurrent ? 'Verarbeiten' : 'Mit aktuellem Prompt neu verarbeiten'}
                        </button>
                    </form>
                    {xlsxExportUrl ? <DownloadButton href={xlsxExportUrl} label="Behörden-XLSX speichern" documentId={doc.id} /> : null}
                </div>
            </div>

            <div className="detail-grid">
                <section>
                    {fileUrl ? (
                        <iframe className="document-frame" src={fileUrl} title={doc.original_name} />
                    ) : (
                        <div className="panel empty">Keine Datei gespeichert.</div>
                    )}
                </section>

                <aside className="side">
                    <section className="panel kv">
                        <div className="kv-row">
                            <div className="kv-label">Hersteller</div>
                            <div className="kv-value">{doc.manufacturer || '-'}</div>
                        </div>
                        <div className="kv-row">
                            <div className="kv-label">Prompt-Version</div>
                            <div className="kv-value">
                                {promptVersion || 'nicht gesetzt'} {promptIsCurrent ? '(aktuell)' : '(neu verarbeiten empfohlen)'}
                            </div>
                        </div>
                        <div className="kv-row">
                            <div className="kv-label">MIME Type</div>
                            <div className="kv-value">{doc.mime_type}</div>
                        </div>
                        <div className="kv-row">
                            <div className="kv-label">Fehler</div>
                            <div className="kv-value">{doc.error_message || '-'}</div>
                        </div>
                    </section>

                    {!promptIsCurrent ? (
                        <section className="panel prompt-warning">
                            <strong>Dieses Dokument wurde noch nicht mit dem aktuellen CSV-Prompt verarbeitet.</strong>
                            <span>Nutze den Reprocess-Button oben, damit Gemini die BMD-Zielzeilen direkt als CSV-Zeilen interpretiert.</span>
                        </section>
                    ) : null}

                    <section className="panel kv">
                        <div className="kv-label">Prüfung</div>
                        <form className="form review-form" action="/api/update-document" method="post">
                            <input type="hidden" name="id" value={doc.id} />
                            {groups.map((group) => (
                                <div className="field-group" key={group.title}>
                                    <div className="field-group-title">{group.title}</div>
                                    {group.fields.map((key) => (
                                        <div key={key} className={`field ${isUncertain(uncertainties, key) ? 'uncertain' : ''}`}>
                                            <label htmlFor={key}>
                                                <span>{key}</span>
                                                <small>{[COC_POINTS[key], FIELD_LABELS[key]].filter(Boolean).join(' · ')}</small>
                                            </label>
                                            <input
                                                id={key}
                                                name={key}
                                                defaultValue={displayValue(key, extractedData[key])}
                                                required={REQUIRED_FIELDS.includes(key)}
                                            />
                                            <span className="confidence">{confidenceLabel(confidenceFor(uncertainties, key))}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                            <button className="primary" type="submit">Speichern und Export erzeugen</button>
                        </form>
                    </section>

                    <section className="panel kv">
                        <div className="kv-label">Unsicherheiten</div>
                        <pre>{JSON.stringify(doc.uncertainties || {}, null, 2)}</pre>
                    </section>

                    {ocrText ? (
                        <section className="panel kv">
                            <div className="kv-label">OCR Text</div>
                            <pre>{ocrText}</pre>
                        </section>
                    ) : null}
                </aside>
            </div>
        </>
    );
}
