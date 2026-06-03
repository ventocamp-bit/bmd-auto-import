import { GoogleGenAI } from '@google/genai';

export interface CocData {
    FIN: string;
    Aussteller: string;
    Marke: string;
    Typ: string;
}

export class GeminiService {
    private ai: GoogleGenAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is missing');
        }
        this.ai = new GoogleGenAI({ apiKey });
    }

    async extractDataFromPdf(pdfBuffer: Buffer): Promise<CocData> {
        const base64Pdf = pdfBuffer.toString('base64');
        const prompt = `
You are an expert at extracting data from Certificates of Conformity (COC).
Analyze the provided PDF image and extract the following fields exactly as they appear:
1. FIN (Fahrzeugidentifikationsnummer)
2. Unterzeichner der Übereinstimmungsbescheinigung (Aussteller)
3. Fabrikmarke (Firmenname des Herstellers)
4. Typ

Return ONLY a pure JSON object without Markdown formatting, matching this exact schema:
{
  "FIN": "value",
  "Aussteller": "value",
  "Marke": "value",
  "Typ": "value"
}
`;
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { data: base64Pdf, mimeType: 'application/pdf' } },
                        { text: prompt }
                    ]
                }
            ],
            config: {
                responseMimeType: 'application/json',
            }
        });

        const rawText = response.text || "{}";
        try {
            return JSON.parse(rawText) as CocData;
        } catch (e) {
            throw new Error('Failed to parse Gemini output as JSON: ' + rawText);
        }
    }
}
