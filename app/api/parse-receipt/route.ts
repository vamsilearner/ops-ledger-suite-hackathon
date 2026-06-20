import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export async function POST(request: Request) {
  try {
    const { rawText } = await request.json();

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "rawText" in the request body.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY environment variable is not configured.' },
        { status: 500 }
      );
    }

    // Initialize Google Gen AI client with User-Agent header as required
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Invoke Gemini model with strict JSON schema
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Please extract receipt details from the raw text provided. Extract the vendor name, the total amount as a float, the category (must strictly classify into one of: Logistics, Marketing, Software, or Office Supplies), and the invoice date formatted strictly as YYYY-MM-DD.

Raw receipt text:
"""
${rawText}
"""`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vendor: {
              type: Type.STRING,
              description: 'The visual name of the vendor/merchant.',
            },
            amount: {
              type: Type.NUMBER,
              description: 'The total spent as a float value.',
            },
            category: {
              type: Type.STRING,
              description: 'Must match one of these values exactly: Logistics, Marketing, Software, Office Supplies.',
            },
            invoice_date: {
              type: Type.STRING,
              description: 'The invoice or transaction date formatted strictly as YYYY-MM-DD.',
            },
          },
          required: ['vendor', 'amount', 'category', 'invoice_date'],
        },
      },
    });

    const textResult = response.text;
    if (!textResult) {
      return NextResponse.json(
        { error: 'The AI model failed to produce a readable response.' },
        { status: 500 }
      );
    }

    // Parse extracted JSON structure and return
    const parsedReceiptResult = JSON.parse(textResult.trim());
    return NextResponse.json(parsedReceiptResult);

  } catch (error: any) {
    console.error('Error parsing receipt:', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred while parsing the receipt.' },
      { status: 500 }
    );
  }
}
