import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API route first
app.post('/api/parse-receipt', async (req, res) => {
  try {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "rawText" in the request body.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not configured.' });
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
      return res.status(500).json({ error: 'The AI model failed to produce a readable response.' });
    }

    // Parse extracted JSON structure and return
    const parsedReceiptResult = JSON.parse(textResult.trim());
    return res.json(parsedReceiptResult);

  } catch (error: any) {
    console.error('Error parsing receipt:', error);
    return res.status(500).json({ error: error?.message || 'An unexpected error occurred while parsing the receipt.' });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
