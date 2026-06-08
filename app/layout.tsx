import './globals.css';

export const metadata = {
    title: 'COC Arbeitszentrale',
    description: 'Upload, Prüfung und BMD Export für COC Dokumente',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="de">
            <body>
                <div className="shell">
                    <header className="topbar">
                        <a className="brand" href="/">COC Arbeitszentrale</a>
                        <nav className="nav">
                            <a href="/">Übersicht</a>
                            <a href="/upload">Upload</a>
                        </nav>
                    </header>
                    <main className="main">{children}</main>
                </div>
            </body>
        </html>
    );
}
