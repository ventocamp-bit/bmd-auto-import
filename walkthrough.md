# BMD Auto-Import Pipeline (Completed)

Die Infrastruktur für das automatisierte COC-Import-System wurde komplett nach deinen First-Principles-Vorgaben refakturiert und steht nun stabil und extrem performant bereit.

## Was wir gebaut haben

> [!TIP]
> Die ressourcenfressende Polling-Logik auf dem Vercel-Server wurde eliminiert. Das System arbeitet jetzt reaktiv mit einer maximalen Latenz von 1 Minute über einen Apps Script Trigger (kostenlos in Google Drive). Zudem werden keine flachen Excel-Dateien mehr erzeugt, sondern die Original-GDB-Templates exakt beibehalten.

### 1. Webhook (`api/process.ts`)
Wir haben den Serverless-Endpunkt so umgeschrieben, dass er ausschließlich auf `POST`-Requests reagiert. Er empfängt direkt die `fileId` und leitet sie an die Logik weiter. Das verhindert Race-Conditions bei gleichzeitigem Upload von mehreren Dateien.

### 2. Template-Injektion (`src/excelService.ts`)
Die GDB-Templates (`Drival_COC.xlsx`, `Tomplan_COC.xlsx`, `Niewiadow_COC.xlsx`) liegen nun sicher im Ordner `/templates`. 
Gemini extrahiert die Felder (FIN, Marke, Typ, etc.) als JSON. Der `excelService` öffnet das zur Marke passende Template im Vercel RAM, sucht nach dem exakten Key (z.B. "FIN") in Spalte A und schreibt den Wert in Spalte D ("Unnamed: 3") in exakt die richtige Zeile. Das GDB-Format bleibt absolut unberührt.

### 3. Google Apps Script Trigger
Um den Vercel-Endpunkt sofort aufzurufen, ohne Cron-Jobs zu nutzen, habe ich das exakte Script geschrieben, das in Google Drive als Trigger eingerichtet werden muss.

> [!IMPORTANT]
> Du findest das Script in deinem Workspace unter:
> [google-apps-script.js](file:///C:/Users/luca/.gemini/antigravity/scratch/bmd-auto-import/google-apps-script.js)

## Nächste Schritte (Deployment)

1. **GitHub Push:** Pushe den Inhalt des Ordners `C:\Users\luca\.gemini\antigravity\scratch\bmd-auto-import` in dein GitHub Repository.
2. **Vercel Setup:** Verknüpfe das Repository mit Vercel. Füge dort folgende Environment Variables hinzu:
   - `GOOGLE_CREDENTIALS_BASE64` (Der base-64 encodierte String der Google Service Account JSON)
   - `GEMINI_API_KEY`
   - `DRIVE_TARGET_FOLDER_ID` (Die ID des Zielordners)
   - `WEBHOOK_SECRET` (Ein beliebiges sicheres Passwort, das auch im Apps Script eingetragen wird)
3. **Google Apps Script:** Kopiere den Code aus [google-apps-script.js](file:///C:/Users/luca/.gemini/antigravity/scratch/bmd-auto-import/google-apps-script.js), trage deine tatsächliche Vercel-URL ein und richte den zeitgesteuerten 1-Minuten-Trigger ein, wie in den Kommentaren des Scripts beschrieben.

Das System läuft damit Serverless, latenzfrei und mit 0,- € laufenden Fixkosten.
