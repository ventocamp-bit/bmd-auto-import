# BMD Auto-Import Pipeline

Das Projekt hat jetzt zwei Importwege: eine Web-App als Arbeitszentrale und einen optionalen Google-Drive-Webhook. Die Web-App ist der produktive Hauptfluss fuer MVP-Tests, weil sie Upload, Status, Verarbeitung, Pruefung und Export sichtbar macht.

## Was wir gebaut haben

### 1. Web-App

Die Next.js-App bietet:

- Upload-Seite fuer eine oder mehrere PDF- und Bilddateien
- Uebersicht mit Status (`new`, `processing`, `review`, `success`, `error`)
- Detailseite mit Dokumentvorschau, extrahierten Feldern, Fehlern und Exportlink
- Pruefformular zum manuellen Korrigieren und Erzeugen des finalen Exports
- API-Route `/api/upload` fuer sichere Uploads ueber den Server
- API-Route `/api/process-document` fuer Extraktion und BMD-Export
- API-Route `/api/update-document` fuer manuelle Korrektur und Export

### 2. Supabase

Supabase wird fuer Datenbank und Dateiablage genutzt.

- Tabelle: `documents`
- Storage Bucket: `coc-documents`
- Storage Bucket: `coc-exports`
- SQL Setup: `supabase/schema.sql`

### 3. Template-Injektion

Die GDB-Templates (`Drival_COC.xlsx`, `Tomplan_COC.xlsx`, `Niewiadow_COC.xlsx`) liegen im Ordner `/templates`.

Gemini extrahiert die Felder als JSON. Der `excelService` oeffnet das passende Template, sucht nach dem exakten Key in Spalte A und schreibt nur in Spalte D derselben Zeile. Das Worksheet wird nicht neu aufgebaut.

### 4. Google Apps Script Trigger

Der Drive-Import bleibt als optionaler Kanal erhalten. Apps Script nutzt einen 1-Minuten-Trigger, iteriert neue Dateien, sendet `fileId` an `/api/process` und nutzt `WEBHOOK_SECRET` per Authorization Header.

Das Script liegt hier:

`google-apps-script.js`

## Naechste Schritte

1. Supabase-Projekt anlegen und `supabase/schema.sql` im SQL Editor ausfuehren.
2. Repository mit Vercel verbinden.
3. Environment Variables in Vercel setzen:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `WEBHOOK_SECRET` nur fuer Google Drive Import
   - `GOOGLE_CREDENTIALS_BASE64` nur fuer Google Drive Import
   - `DRIVE_TARGET_FOLDER_ID` nur fuer Google Drive Import
4. Lokal `npm run build` ausfuehren.
5. Auf Vercel deployen.
6. MVP-Test: Dateien ueber `/upload` hochladen, Detailseite oeffnen, `Verarbeiten` klicken, Export herunterladen.

Das System ist damit fuer Free-Tier-MVP-Tests nutzbar. Bei wachsendem Volumen koennen OCR, Storage und Processing gezielt auf Paid-Tiers oder Worker-Infrastruktur erweitert werden.
