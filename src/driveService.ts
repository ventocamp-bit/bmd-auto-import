import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

export class DriveService {
    private drive: drive_v3.Drive;

    constructor() {
        const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
        if (!credentialsBase64) {
            throw new Error('GOOGLE_CREDENTIALS_BASE64 is missing');
        }
        
        const credentials = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString('utf-8'));
        
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        this.drive = google.drive({ version: 'v3', auth });
    }

    async getFile(fileId: string): Promise<drive_v3.Schema$File> {
        const response = await this.drive.files.get({
            fileId,
            fields: 'id, name, mimeType',
        });
        return response.data;
    }

    async listFiles(folderId: string): Promise<drive_v3.Schema$File[]> {
        const response = await this.drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType)',
        });
        return response.data.files || [];
    }

    async downloadFile(fileId: string): Promise<Buffer> {
        const response = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            response.data.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.data.on('error', reject);
            response.data.on('end', () => resolve(Buffer.concat(chunks)));
        });
    }

    async uploadFile(name: string, buffer: Buffer, parentFolderId: string, mimeType: string): Promise<string> {
        const fileMetadata = {
            name,
            parents: [parentFolderId]
        };
        const media = {
            mimeType,
            body: Readable.from(buffer)
        };
        const response = await this.drive.files.create({
            requestBody: fileMetadata,
            media,
            fields: 'id',
        });
        return response.data.id!;
    }

    async moveFile(fileId: string, newParentId: string): Promise<void> {
        const file = await this.drive.files.get({
            fileId,
            fields: 'parents'
        });
        const previousParents = file.data.parents?.join(',') || '';
        
        await this.drive.files.update({
            fileId,
            addParents: newParentId,
            removeParents: previousParents,
        });
    }

    async deleteFile(fileId: string): Promise<void> {
        await this.drive.files.delete({ fileId });
    }
}
