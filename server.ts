import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// High payload limit for large documents & PDF files (100MB)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION = `You are an expert professional document translator.
Translate the user's text or document directly and accurately into natural, standard Myanmar (Burmese) Unicode script.
Rules:
1. Translate accurately and completely without omitting any paragraphs, sections, or lines.
2. Preserve original formatting, headings, bullet lists, numbered points, and paragraph breaks.
3. Keep dates, numbers, formulas, and technical abbreviations intact.
4. Do NOT include pronunciation guides, phonetic transcriptions, word-by-word breakdowns, or conversational preamble/notes.
5. Return ONLY the clean, translated Myanmar text directly.`;

/**
 * Robust multi-model translation with automatic fallback to active models
 */
async function generateTranslationWithFallback({
  prompt,
  parts,
  systemInstruction,
}: {
  prompt?: string;
  parts?: any[];
  systemInstruction?: string;
}): Promise<string> {
  const models = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ];

  let lastError: any = null;

  for (const model of models) {
    try {
      let response;
      const config: any = {
        systemInstruction: systemInstruction || SYSTEM_INSTRUCTION,
        temperature: 0.2,
      };

      if (parts && parts.length > 0) {
        response = await ai.models.generateContent({
          model,
          contents: { parts },
          config,
        });
      } else {
        response = await ai.models.generateContent({
          model,
          contents: prompt || '',
          config,
        });
      }

      const text = response?.text?.trim();
      if (text) {
        return text;
      }
    } catch (err: any) {
      console.warn(`Model ${model} encounter:`, err.status || err.message);
      lastError = err;
      // Immediately fallback to next available model
      continue;
    }
  }

  throw lastError || new Error('All translation models encountered errors.');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Single Chunk Translation endpoint
app.post('/api/translate-chunk', async (req, res) => {
  req.setTimeout(300000);
  res.setTimeout(300000);

  try {
    const { chunkText, chunkIndex, totalChunks, customInstructions } = req.body;

    if (!chunkText || typeof chunkText !== 'string') {
      return res.status(400).json({ error: 'Chunk text is required.' });
    }

    const prompt = `Translate the following text into fluent, natural Myanmar (Burmese) language:\n\n${chunkText}${customInstructions ? `\nStyle: ${customInstructions}` : ''}`;

    const translatedText = await generateTranslationWithFallback({ prompt });

    return res.json({
      success: true,
      translatedText,
      chunkIndex,
      totalChunks,
    });
  } catch (error: any) {
    console.error(`Chunk translation error (Part ${req.body?.chunkIndex}):`, error);
    return res.status(500).json({
      error: error.message || 'Failed to translate chunk.',
    });
  }
});

// Full Translation Endpoint
app.post('/api/translate', async (req, res) => {
  req.setTimeout(600000);
  res.setTimeout(600000);

  try {
    const { text, fileBase64, mimeType, filename, customInstructions } = req.body;

    if (!text && !fileBase64) {
      return res.status(400).json({ error: 'Text or file content is required for translation.' });
    }

    let translatedText = '';

    if (fileBase64 && mimeType && mimeType.includes('pdf')) {
      // PDF input direct to Gemini
      const parts = [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: fileBase64,
          },
        },
        {
          text: `Translate the content of this document into clear, fluent, natural Myanmar (Burmese) language directly without delay.${customInstructions ? ` Additional notes: ${customInstructions}` : ''}`,
        },
      ];
      translatedText = await generateTranslationWithFallback({ parts });
    } else {
      // Text or extracted document text
      const contentToTranslate = text || 'No text extracted';
      const prompt = `Translate the following text into fluent, natural, grammatically correct Myanmar (Burmese) language:\n\n${contentToTranslate}${customInstructions ? `\nStyle: ${customInstructions}` : ''}`;
      translatedText = await generateTranslationWithFallback({ prompt });
    }

    return res.json({
      success: true,
      translatedText,
      filename: filename || 'document',
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to translate document to Myanmar.',
    });
  }
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // Mount Vite middleware in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.timeout = 600000;
  server.keepAliveTimeout = 610000;
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
