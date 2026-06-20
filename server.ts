import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API route first using OpenRouter as requested
app.post('/api/parse-receipt', async (req, res) => {
  try {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "rawText" in the request body.' });
    }

    // Fallback securely to the provided OpenRouter API key if not configured in environmental variables
    const apiKey = process.env.OPENROUTER_API_KEY 

    const prompt = `Please extract receipt details from the raw text provided. Extract the vendor name, the total amount as a float/number, the category (must strictly classify into one of: Logistics, Marketing, Software, or Office Supplies), and the invoice date formatted strictly as YYYY-MM-DD.

You MUST respond with a valid JSON object matching this schema exactly:
{
  "vendor": "Name of the merchant",
  "amount": 123.45,
  "category": "Logistics" | "Marketing" | "Software" | "Office Supplies",
  "invoice_date": "YYYY-MM-DD"
}

Do not include any conversational text or markdown code blocks like \`\`\`json. Output raw JSON object only.

Raw receipt text:
"""
${rawText}
"""`;

    // Modern fetch call to OpenRouter API endpoint
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ai.studio/build',
        'X-OpenRouter-Title': 'Ops Ledger Suite'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: {
          type: 'json_object'
        }
      })
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error('OpenRouter Error:', errorText);
      throw new Error(`OpenRouter returned status code ${openRouterResponse.status}: ${errorText}`);
    }

    const outputData: any = await openRouterResponse.json();
    const messageContent = outputData.choices?.[0]?.message?.content;

    if (!messageContent) {
      return res.status(500).json({ error: 'The AI model failed to produce any response content.' });
    }

    // Direct JSON parsing of response content
    const parsedReceiptResult = JSON.parse(messageContent.trim());
    return res.json(parsedReceiptResult);

  } catch (error: any) {
    console.error('Error parsing receipt with OpenRouter API:', error);
    return res.status(500).json({ error: error?.message || 'Unexpected failure while processing operational receipt.' });
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
