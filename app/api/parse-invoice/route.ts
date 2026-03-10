// app/api/parse-invoice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to safely parse the model JSON
function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Shape we expect back from the model
type InvoiceSuggestion = {
  month: string; // e.g. "January 2025"
  electricity_kwh: number; // total kWh from electricity bill
  fuel_litres: number; // total litres from fuel receipt (diesel or petrol — UI maps to correct field)
  gas_kwh: number; // total kWh from gas bill
  refrigerant_kg: number; // kg leaked / charged
  refrigerant_type?: string; // e.g. "R410A", "R407C", etc.
};

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not set on the server' },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const docType = (formData.get('docType') as string) || 'electricity';
    const monthHint = (formData.get('monthHint') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Detect file type
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // For PDFs: extract text and send as text prompt
    // For images: send as base64 image_url (existing behaviour)
    let extractedPdfText: string | null = null;
    if (isPdf) {
      // Dynamic import avoids the pdf-parse test-file issue in Next.js App Router
      // Cast to any — pdf-parse ESM types don't expose a callable default signature
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { default: pdfParse } = (await import('pdf-parse')) as any;
      const pdfData = await pdfParse(buffer) as { text: string };
      extractedPdfText = pdfData.text;
      if (!extractedPdfText?.trim()) {
        return NextResponse.json(
          { error: 'Could not extract text from this PDF. If it is a scanned image, please upload a photo of the bill instead.' },
          { status: 422 }
        );
      }
    }

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${
      file.type || 'application/octet-stream'
    };base64,${base64}`;

    const systemPrompt = `
You are an assistant helping SMEs extract activity data from utility invoices for carbon reporting.

The user has uploaded one document. It may be:
- an electricity bill from any global utility provider,
- a fuel receipt (diesel or petrol),
- a gas bill (natural gas / mains gas),
- or a refrigerant / AC maintenance invoice.

Your job is to read the document carefully and return **only structured data** in JSON, no explanations.

General rules:
- If you cannot find a value, set it to 0 (do NOT leave it null).
- Try to infer the **billing period month and year** and express it as "Month YYYY", e.g. "January 2025".
- If there are multiple line items, sum them to one total per invoice.

JSON fields you must always return:

{
  "month": "Month YYYY",
  "electricity_kwh": number,
  "fuel_litres": number,
  "gas_kwh": number,
  "refrigerant_kg": number,
  "refrigerant_type": "string"
}

Specific guidance by document type:
- If docType = "electricity":
  - Focus on total kWh for the billing period (NOT demand charges, NOT previous balance).
  - "electricity_kwh" should be the total active energy consumption in kWh.
  - All other fields should be 0.

- If docType = "diesel" or docType = "petrol":
  - Focus on total litres of fuel purchased.
  - Use "fuel_litres" as the sum of all litres on the receipt.
  - All other fields should be 0.

- If docType = "gas":
  - Focus on total gas consumed for the billing period.
  - Return the value in kWh as "gas_kwh".
  - If the bill shows cubic metres (m³), convert to kWh by multiplying by 11.2.
  - All other fields should be 0.

- If docType = "refrigerant":
  - Focus on kg of refrigerant charged / refilled / leaked.
  - "refrigerant_kg" should be the total kg.
  - "refrigerant_type" should be the gas code, e.g. "R410A", "R134a", "R404A", "R407C" etc.
  - All other fields should be 0.
`;

    const userPrompt = `
Document type (hint): ${docType}
Month hint (if provided by user): ${monthHint}

Return ONLY valid JSON with the exact fields:
- month (string, "Month YYYY")
- electricity_kwh (number)
- fuel_litres (number)
- gas_kwh (number)
- refrigerant_kg (number)
- refrigerant_type (string, can be "GENERIC_HFC" if not specified)
`;

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = extractedPdfText
      ? [
          { type: 'text', text: userPrompt },
          { type: 'text', text: `\n\nExtracted bill text (all pages):\n\n${extractedPdfText}` },
        ]
      : [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    const messageContent = completion.choices[0]?.message?.content;

    let parsed: InvoiceSuggestion | null = null;

    if (typeof messageContent === 'string') {
      parsed = safeJsonParse<InvoiceSuggestion>(messageContent);
    } else if (Array.isArray(messageContent)) {
  const arr = (messageContent as any[]) || [];

  const textPart = arr.find((p: any) => p?.type === 'text') as
    | { type: 'text'; text: string }
    | undefined;

      if (textPart) {
        parsed = safeJsonParse<InvoiceSuggestion>(textPart.text);
      }
    }

    if (!parsed) {
      // Fallback if parsing failed – keep behaviour safe
      return NextResponse.json(
        {
          error: 'Could not parse model output',
        },
        { status: 502 }
      );
    }

    // Normalise types + defaults so the front-end has something safe to use
    const suggestion: InvoiceSuggestion = {
      month: parsed.month || monthHint || '',
      electricity_kwh: Number(parsed.electricity_kwh) || 0,
      fuel_litres: Number(parsed.fuel_litres) || 0,
      gas_kwh: Number(parsed.gas_kwh) || 0,
      refrigerant_kg: Number(parsed.refrigerant_kg) || 0,
      refrigerant_type: parsed.refrigerant_type || 'GENERIC_HFC',
    };

    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error('parse-invoice error', err);
    return NextResponse.json(
      { error: 'Failed to parse invoice' },
      { status: 500 }
    );
  }
}
