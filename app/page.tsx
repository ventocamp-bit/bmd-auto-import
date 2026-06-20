import Link from 'next/link';
import { getSupabaseAdmin, DocumentRecord } from '../src/supabaseService';
import { BatchDownloadButton } from './BatchDownloadButton';

export const dynamic = 'force-dynamic';

function formatDate(value: string) {
    return new Intl.DateTimeFormat('de-AT', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}

function archivedAt(doc: DocumentRecord) {
    const value = doc.uncertainties?.archivedAt;
    return typeof value === 'string' ? value : null;
}

function isStaleProcessing(doc: DocumentRecord) {
    if (doc.status !== 'processing') {
        return false;
    }

    const referenceTime = new Date(doc.updated_at || doc.created_at).getTime();
    return Date.now() - referenceTime > 10 * 60 * 1000;
}

async function getDocuments(showArchive: boolean): Promise<DocumentRecord[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) {
        throw new Error(error.message);
    }

    return (data as DocumentRecord[])
        .filter((doc) => showArchive ? archivedAt(doc) : !archivedAt(doc))
        .sort((a, b) => {
            if (!showArchive) {
                return 0;
            }

            return new Date(archivedAt(b) || 0).getTime() - new Date(archivedAt(a) || 0).getTime();
        });
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ archive?: string }> }) {
    const { archive } = await searchParams;
    const showArchive = archive === '1';
    const documents = await getDocuments(showArchive);
    const newCount = documents.filter((doc) => doc.status === 'new' || isStaleProcessing(doc)).length;
    const reviewCount = documents.filter((doc) => doc.status === 'review').length;
    const successCount = documents.filter((doc) => doc.status === 'success').length;
    const exportableCount = documents.filter((doc) => doc.status === 'success' || doc.status === 'review').length;

    return (
        <>
            <div className="header-row">
                <div>
                    <h1>{showArchive ? 'Archiv' : 'Dokumente'}</h1>
                    <p>COC Uploads, Extraktion, Prüfung und BMD Export.</p>
                    <p>{newCount} neu · {reviewCount} zu prüfen · {successCount} geprüft</p>
                </div>
                <div className="actions">
                    {showArchive ? (
                        <Link className="button" href="/">Aktive Dokumente</Link>
                    ) : (
                        <>
                            <form action="/api/process-pending" method="post">
                                <button className="primary" type="submit" disabled={newCount === 0}>Nächstes neues verarbeiten</button>
                            </form>
                            <BatchDownloadButton disabled={exportableCount === 0} />
                            <Link className="button" href="/?archive=1">Archiv</Link>
                            <Link className="button primary" href="/upload">Datei hochladen</Link>
                        </>
                    )}
                </div>
            </div>

            <section className="panel">
                {documents.length === 0 ? (
                    <div className="empty">{showArchive ? 'Noch keine Dokumente archiviert.' : 'Noch keine aktiven Dokumente.'}</div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Datei</th>
                                <th>Status</th>
                                <th>Hersteller</th>
                                <th>{showArchive ? 'Archiviert' : 'Erstellt'}</th>
                                <th>Prüfung</th>
                                <th></th>
                                {!showArchive ? <th></th> : null}
                            </tr>
                        </thead>
                        <tbody>
                            {documents.map((doc) => (
                                <tr key={doc.id}>
                                    <td>{doc.original_name}</td>
                                    <td><span className={`status ${doc.status}`}>{isStaleProcessing(doc) ? 'new' : doc.status}</span></td>
                                    <td>{doc.manufacturer || '-'}</td>
                                    <td>{formatDate((showArchive && archivedAt(doc)) ? archivedAt(doc)! : doc.created_at)}</td>
                                    <td>{doc.status === 'success' ? 'geprüft' : doc.status === 'review' ? 'prüfen' : 'offen'}</td>
                                    <td><Link className="button" href={`/documents/${doc.id}`}>Öffnen</Link></td>
                                    {!showArchive ? (
                                        <td>
                                            <form action="/api/archive-document" method="post">
                                                <input type="hidden" name="id" value={doc.id} />
                                                <button type="submit">
                                                    {doc.status === 'success' ? 'Geprüft ablegen' : 'Aus Liste entfernen'}
                                                </button>
                                            </form>
                                        </td>
                                    ) : null}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </>
    );
}
