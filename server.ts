import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  CODE_REVIEW_SYSTEM_INSTRUCTION,
  ENGINEERED_SYSTEM_INSTRUCTION,
  FEW_SHOT_EXAMPLES,
  formatApiError,
  ragStore,
  type ChatTurn,
} from './server/ragPipeline.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '2mb' }));

  // Health & Vector Index Status
  app.get('/api/health', (_req, res) => {
    const status = ragStore.getStatus();
    res.json({
      ok: true,
      ...status,
    });
  });

  // List all source documents and their chunk breakdown
  app.get('/api/documents', (_req, res) => {
    const documents = ragStore.getDocuments();
    const chunks = ragStore.getAllChunks();
    const status = ragStore.getStatus();
    res.json({
      documents,
      chunks,
      status,
    });
  });

  // Trigger or force-rebuild vector embeddings across all chunks
  app.post('/api/index', async (req, res) => {
    try {
      const force = Boolean(req.body?.force);
      await ragStore.ensureIndexed(force);
      res.json({
        ok: true,
        status: ragStore.getStatus(),
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Add a custom document to the live vector store
  app.post('/api/documents', async (req, res) => {
    try {
      const { title, category, author, content } = req.body ?? {};
      const result = await ragStore.addDocument({
        title: String(title ?? ''),
        category: String(category ?? 'User Upload'),
        author: author ? String(author) : undefined,
        content: String(content ?? ''),
      });
      res.status(201).json({
        ok: true,
        ...result,
        status: ragStore.getStatus(),
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Delete any document from the vector store
  app.delete('/api/documents/:id', async (req, res) => {
    try {
      await ragStore.deleteDocument(req.params.id);
      res.json({
        ok: true,
        status: ragStore.getStatus(),
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Restore default IntelliFlow engineering standards documents
  app.post('/api/documents/restore', async (_req, res) => {
    try {
      await ragStore.restoreDefaults();
      res.json({
        ok: true,
        status: ragStore.getStatus(),
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Fetch and index a document or raw code file from a URL
  app.post('/api/documents/fetch-url', async (req, res) => {
    try {
      const { url, title, category } = req.body ?? {};
      const result = await ragStore.addDocumentFromUrl({
        url: String(url ?? ''),
        title: title ? String(title) : undefined,
        category: category ? String(category) : undefined,
      });
      res.status(201).json({
        ok: true,
        ...result,
        status: ragStore.getStatus(),
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Semantic Vector Search across all indexed chunks
  app.post('/api/search', async (req, res) => {
    try {
      const { query, topK, minSimilarity } = req.body ?? {};
      const result = await ragStore.semanticSearch({
        query: String(query ?? ''),
        topK: typeof topK === 'number' ? topK : undefined,
        minSimilarity: typeof minSimilarity === 'number' ? minSimilarity : undefined,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Generate grounded AI summary & suggested questions for a specific document
  app.post('/api/documents/:id/brief', async (req, res) => {
    try {
      const result = await ragStore.summarizeDocument(req.params.id);
      res.json(result);
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Execute RAG-grounded Code Review (AI-4 integration)
  app.post('/api/code-review', async (req, res) => {
    try {
      const { code, language, focus, topK, minSimilarity } = req.body ?? {};
      const result = await ragStore.reviewCodeWithRag({
        code: String(code ?? ''),
        language: language ? String(language) : undefined,
        focus: focus ? String(focus) : undefined,
        topK: typeof topK === 'number' ? topK : undefined,
        minSimilarity: typeof minSimilarity === 'number' ? minSimilarity : undefined,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Generate an auto-fixed version of code grounded in review findings
  app.post('/api/code-fix', async (req, res) => {
    try {
      const { code, language, findings, retrievedChunks } = req.body ?? {};
      const result = await ragStore.generateCodeFixWithRag({
        code: String(code ?? ''),
        language: language ? String(language) : undefined,
        findings: Array.isArray(findings) ? findings : [],
        retrievedChunks: Array.isArray(retrievedChunks) ? retrievedChunks : [],
      });
      res.json(result);
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Expose the deliberately engineered prompt configuration for the Prompt Lab view
  app.get('/api/prompt-config', (_req, res) => {
    res.json({
      systemInstruction: ENGINEERED_SYSTEM_INSTRUCTION,
      codeReviewSystemInstruction: CODE_REVIEW_SYSTEM_INSTRUCTION,
      fewShotExamples: FEW_SHOT_EXAMPLES,
      schemaFields: [
        { name: 'answer', type: 'STRING', description: 'Grounded prose with inline [C1], [C2] citations or abstention explanation' },
        { name: 'grounded', type: 'BOOLEAN', description: 'True only when claims are verified in retrieved passages' },
        { name: 'confidence', type: 'STRING', description: 'high | medium | insufficient' },
        { name: 'citedChunkIds', type: 'ARRAY<STRING>', description: 'Verified passage IDs referenced in the answer' },
        { name: 'abstentionReason', type: 'STRING', description: 'Exact evidence gap when grounded=false' },
        { name: 'suggestedFollowUps', type: 'ARRAY<STRING>', description: 'Grounded follow-up questions derived from retrieved context' },
      ],
      status: ragStore.getStatus(),
    });
  });

  // Execute RAG query: embed -> cosine retrieve -> engineered prompt -> structured output
  app.post('/api/chat', async (req, res) => {
    try {
      const { query, history, topK, minSimilarity } = req.body ?? {};
      const cleanHistory: ChatTurn[] = Array.isArray(history)
        ? history
            .filter(
              (h): h is ChatTurn =>
                h &&
                (h.role === 'user' || h.role === 'assistant') &&
                typeof h.content === 'string'
            )
            .slice(-8)
        : [];

      const result = await ragStore.query({
        query: String(query ?? ''),
        history: cleanHistory,
        topK: typeof topK === 'number' ? topK : undefined,
        minSimilarity: typeof minSimilarity === 'number' ? minSimilarity : undefined,
      });

      res.json(result);
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StackLens server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
