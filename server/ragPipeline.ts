import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  chunkDocument,
  DEFAULT_DOCUMENTS,
  type DocumentChunk,
  type SourceDocument,
} from './knowledgeBase.ts';

const EMBEDDING_MODEL = 'gemini-embedding-2';
const GENERATION_MODEL = 'gemini-3.1-flash-lite';
const CACHE_FILE = path.resolve(process.cwd(), '.rag-embeddings-cache.json');

export interface IndexedChunk extends DocumentChunk {
  embedding: number[];
  embeddingNorm: number;
  contentHash: string;
}

export interface RetrievedChunk {
  id: string;
  citationLabel: string;
  docId: string;
  docTitle: string;
  docCode: string;
  category: string;
  sectionTitle: string;
  chunkIndex: number;
  totalChunksInDoc: number;
  text: string;
  similarity: number;
  passedThreshold: boolean;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface FewShotExample {
  label: string;
  userQuery: string;
  retrievedContextSnippet: string;
  expectedJson: {
    answer: string;
    grounded: boolean;
    confidence: 'high' | 'medium' | 'insufficient';
    citedChunkIds: string[];
    abstentionReason: string;
  };
}

export interface PromptTrace {
  model: string;
  embeddingModel: string;
  standaloneQuery: string;
  topK: number;
  minSimilarity: number;
  systemInstruction: string;
  fewShotExamplesCount: number;
  assembledUserPrompt: string;
  latencyMs: number;
}

export interface RagQueryResult {
  answer: string;
  grounded: boolean;
  confidence: 'high' | 'medium' | 'insufficient';
  citedChunkIds: string[];
  abstentionReason: string;
  suggestedFollowUps: string[];
  retrievedChunks: RetrievedChunk[];
  promptTrace: PromptTrace;
}

export interface CodeReviewFinding {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  lineHint: string;
  detail: string;
  recommendation: string;
  citedChunkIds: string[];
}

export interface CodeReviewResult {
  overallStatus: 'pass' | 'needs_changes' | 'critical_issues';
  summary: string;
  findings: CodeReviewFinding[];
  citedChunkIds: string[];
  retrievedChunks: RetrievedChunk[];
  promptTrace: PromptTrace;
}

export interface CodeFixResult {
  fixedCode: string;
  changeSummary: string;
  latencyMs: number;
}

export interface DocumentBriefResult {
  docId: string;
  summaryBullets: string[];
  suggestedQuestions: string[];
  latencyMs: number;
}

export interface SemanticSearchResult {
  query: string;
  results: RetrievedChunk[];
  latencyMs: number;
}

export const ENGINEERED_SYSTEM_INSTRUCTION = `You are the StackLens Grounded Knowledge Assistant for engineering teams and code reviewers.

CORE GROUNDING MANDATE:
1. Answer ONLY using facts explicitly stated in the <retrieved_context> passages below.
2. NEVER use outside general knowledge, pretraining trivia, assumptions, or extrapolation—even if you know the answer to a general-world question (such as capitals, historical dates, or external frameworks not in the context).
3. Every factual statement in your "answer" MUST include an inline citation matching the exact passage label in square brackets, such as [C1] or [C2].
4. List every passage ID you cited (e.g., "C1", "C2") in the "citedChunkIds" array.

GRACEFUL ABSTENTION ("I DON'T KNOW") PROTOCOL:
- If <retrieved_context> is empty, marked as below the similarity threshold without supporting facts, or does not explicitly contain the information requested, you MUST abstain.
- When abstaining:
  * Set "grounded" to false.
  * Set "confidence" to "insufficient".
  * Set "citedChunkIds" to [].
  * Set "suggestedFollowUps" to [].
  * Write a concise, helpful "answer" starting with "I cannot verify this from the indexed StackLens knowledge base." and briefly name what specific detail was not found in the retrieved passages.
  * Populate "abstentionReason" with the exact gap between the user's question and the retrieved context.
- Never guess numbers, extrapolate unstated rule codes (e.g., SL-K8S-999), or fabricate policy details.

FOLLOW-UP QUESTIONS:
- When grounded=true, provide exactly 2 short, concrete follow-up questions in "suggestedFollowUps" that are answerable from the retrieved context.

STYLE & PRECISION:
- Preserve exact limits, timeouts, headers, rule codes, and numbers verbatim from the source passages (e.g., "900 seconds", "X-StackLens-Trace-Id", "3,500 ms").
- Be concise, direct, and structured.`;

export const CODE_REVIEW_SYSTEM_INSTRUCTION = `You are the StackLens RAG-Grounded Code Reviewer.

REVIEW MANDATE:
1. Inspect the user's submitted code snippet against BOTH general software defects (bugs, security flaws, async leaks, N+1 loops) AND the retrieved StackLens Engineering Standards in <retrieved_context>.
2. Whenever a finding relates to a retrieved standard passage, cite its passage ID inline in "detail" or "recommendation" using square brackets like [C1] or [C2], and include those IDs in "citedChunkIds".
3. Do not invent fake internal rule codes that do not appear in <retrieved_context>.
4. Classify each finding accurately as "critical", "warning", or "info", include a concrete "lineHint" (e.g., "Line 4-8" or "Fetch handler"), and provide an actionable fix in "recommendation".`;

export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    label: 'Grounded Single-Source Policy',
    userQuery: 'What is the maximum JWT access token TTL and what header must /api/* requests include?',
    retrievedContextSnippet:
      '[C1 | SL-SEC-101 | 1.1 Token Lifetimes and Rotation]\nAll authenticated web sessions in StackLens services must issue short-lived JWT access tokens with a strict maximum TTL of 900 seconds (15 minutes).\n[C2 | SL-SEC-101 | 1.2 Mandatory Trace Header and Server-Only Keys]\nEvery API request between client and backend under /api/* must propagate the correlation header X-StackLens-Trace-Id (UUID v4) for auditability.',
    expectedJson: {
      answer:
        'StackLens JWT access tokens have a strict maximum TTL of **900 seconds** (15 minutes) [C1]. Every `/api/*` request between client and backend must propagate the **`X-StackLens-Trace-Id`** (UUID v4) correlation header [C2].',
      grounded: true,
      confidence: 'high',
      citedChunkIds: ['C1', 'C2'],
      abstentionReason: '',
    },
  },
  {
    label: 'Cross-Document Synthesis',
    userQuery: 'What SQL statement timeout applies, and what HTTP status + backoff base is used for transient failures?',
    retrievedContextSnippet:
      '[C1 | SL-PRF-309 | 3.1 Query Timeouts and Connection Pooling]\nEvery relational database query in StackLens backend services must enforce a statement timeout of 3,500 ms.\n[C2 | SL-API-204 | 2.2 Retry Backoff and Upstream Resilience]\nWhen calling external inference APIs that return transient HTTP 429 (RESOURCE_EXHAUSTED) or 503 (UNAVAILABLE) errors, backend services must apply exponential backoff starting at a base delay of 450 ms, doubling per attempt up to a maximum of 3 retries.',
    expectedJson: {
      answer:
        'All relational database queries must enforce a **3,500 ms** statement timeout [C1]. For transient HTTP **429** or **503** upstream errors, services apply exponential backoff starting at **450 ms** up to 3 retries [C2].',
      grounded: true,
      confidence: 'high',
      citedChunkIds: ['C1', 'C2'],
      abstentionReason: '',
    },
  },
  {
    label: 'Graceful Abstention (Out-of-Scope / Unindexed Rule)',
    userQuery: 'What is the capital city of France, and what is rule SL-K8S-999?',
    retrievedContextSnippet:
      '[C1 | SL-API-204 | 2.3 Canonical JSON Error Envelope | similarity: 0.41 — BELOW THRESHOLD]\nAll non-2xx API responses must return a structured JSON payload containing three mandatory keys: error, code, and traceId.',
    expectedJson: {
      answer:
        'I cannot verify this from the indexed StackLens knowledge base. The indexed documents do not contain external world geography or any specification for rule SL-K8S-999.',
      grounded: false,
      confidence: 'insufficient',
      citedChunkIds: [],
      abstentionReason:
        'Retrieved passages cover API error envelopes and lack any reference to France or rule SL-K8S-999.',
    },
  },
];

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Add your Gemini API key in the Settings > Secrets panel and retry.'
    );
    (err as Error & { statusCode?: number; code?: string }).statusCode = 500;
    (err as Error & { statusCode?: number; code?: string }).code = 'MISSING_API_KEY';
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatApiError(error: unknown): { message: string; statusCode: number; code: string } {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const customStatus = (error as { statusCode?: number })?.statusCode;
  const customCode = (error as { code?: string })?.code;

  if (customCode === 'MISSING_API_KEY') {
    return { message: rawMessage, statusCode: 500, code: 'MISSING_API_KEY' };
  }
  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('400')) {
    return {
      message:
        'The configured GEMINI_API_KEY appears invalid. Please verify it in Settings > Secrets.',
      statusCode: 400,
      code: 'API_KEY_INVALID',
    };
  }
  if (rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('403')) {
    return {
      message:
        'Permission denied by Gemini API. Check your API key permissions in Settings > Secrets.',
      statusCode: 403,
      code: 'PERMISSION_DENIED',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    return {
      message: 'Gemini API rate or quota limit reached (429). Please wait a moment and retry.',
      statusCode: 429,
      code: 'RESOURCE_EXHAUSTED',
    };
  }

  return {
    message: rawMessage || 'Unexpected error communicating with Gemini API.',
    statusCode: customStatus ?? 502,
    code: customCode ?? 'GEMINI_API_ERROR',
  };
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('fetch failed');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 450 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function hashChunkInput(text: string): string {
  return crypto.createHash('sha256').update(`${EMBEDDING_MODEL}::${text}`).digest('hex');
}

function buildEmbeddingInput(chunk: DocumentChunk): string {
  return `Document: ${chunk.docTitle} (${chunk.docCode}) | Section: ${chunk.sectionTitle}\n${chunk.text}`;
}

function computeNorm(vec: number[]): number {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], aNorm: number, b: number[], bNorm: number): number {
  if (a.length === 0 || a.length !== b.length || aNorm === 0 || bNorm === 0) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot / (aNorm * bNorm);
}

class RagVectorStore {
  private documents: SourceDocument[] = [...DEFAULT_DOCUMENTS];
  private indexedChunks: IndexedChunk[] = [];
  private embeddingCache: Map<string, number[]> = new Map();
  private indexingPromise: Promise<void> | null = null;
  private isIndexed = false;
  private lastIndexedAt: string | null = null;

  constructor() {
    this.loadCacheFromDisk();
  }

  private loadCacheFromDisk(): void {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, number[]>;
        for (const [k, v] of Object.entries(parsed)) {
          if (Array.isArray(v) && v.length > 0) {
            this.embeddingCache.set(k, v);
          }
        }
      }
    } catch {
      // Ignore corrupt cache file; will re-embed cleanly via Gemini API
    }
  }

  private saveCacheToDisk(): void {
    try {
      const obj: Record<string, number[]> = {};
      for (const [k, v] of this.embeddingCache.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(obj), 'utf-8');
    } catch {
      // Non-fatal if filesystem is read-only
    }
  }

  public getDocuments(): SourceDocument[] {
    return this.documents;
  }

  public getAllChunks(): Array<
    DocumentChunk & { indexed: boolean; embeddingDims: number }
  > {
    if (this.isIndexed && this.indexedChunks.length > 0) {
      return this.indexedChunks.map((c) => ({
        id: c.id,
        docId: c.docId,
        docTitle: c.docTitle,
        docCode: c.docCode,
        category: c.category,
        sectionTitle: c.sectionTitle,
        chunkIndex: c.chunkIndex,
        totalChunksInDoc: c.totalChunksInDoc,
        charCount: c.charCount,
        text: c.text,
        indexed: true,
        embeddingDims: c.embedding.length,
      }));
    }

    const raw = this.documents.flatMap((d) => chunkDocument(d));
    return raw.map((c) => {
      const hash = hashChunkInput(buildEmbeddingInput(c));
      const cached = this.embeddingCache.get(hash);
      return {
        ...c,
        indexed: Boolean(cached),
        embeddingDims: cached ? cached.length : 0,
      };
    });
  }

  public getStatus(): {
    documentCount: number;
    chunkCount: number;
    isIndexed: boolean;
    embeddingModel: string;
    generationModel: string;
    embeddingDims: number;
    lastIndexedAt: string | null;
  } {
    const chunks = this.getAllChunks();
    const dims = chunks.find((c) => c.embeddingDims > 0)?.embeddingDims ?? 0;
    return {
      documentCount: this.documents.length,
      chunkCount: chunks.length,
      isIndexed: this.isIndexed && chunks.every((c) => c.indexed),
      embeddingModel: EMBEDDING_MODEL,
      generationModel: GENERATION_MODEL,
      embeddingDims: dims,
      lastIndexedAt: this.lastIndexedAt,
    };
  }

  public async ensureIndexed(forceRebuild = false): Promise<void> {
    if (this.isIndexed && !forceRebuild) {
      return;
    }
    if (this.indexingPromise) {
      return this.indexingPromise;
    }

    this.indexingPromise = (async () => {
      try {
        const allRawChunks = this.documents.flatMap((doc) => chunkDocument(doc));
        const pending: Array<{ chunk: DocumentChunk; input: string; hash: string }> = [];

        for (const chunk of allRawChunks) {
          const input = buildEmbeddingInput(chunk);
          const hash = hashChunkInput(input);
          if (forceRebuild || !this.embeddingCache.has(hash)) {
            pending.push({ chunk, input, hash });
          }
        }

        if (pending.length > 0) {
          const ai = getGeminiClient();
          const CONCURRENCY = 6;
          for (let i = 0; i < pending.length; i += CONCURRENCY) {
            const batch = pending.slice(i, i + CONCURRENCY);
            const results = await Promise.all(
              batch.map((item) =>
                withRetry(() =>
                  ai.models.embedContent({
                    model: EMBEDDING_MODEL,
                    contents: item.input,
                  })
                )
              )
            );

            for (let j = 0; j < batch.length; j++) {
              const values = results[j].embeddings?.[0]?.values;
              if (!values || values.length === 0) {
                throw new Error(`Empty embedding vector returned for chunk ${batch[j].chunk.id}.`);
              }
              this.embeddingCache.set(batch[j].hash, values);
            }
          }
          this.saveCacheToDisk();
        }

        this.indexedChunks = allRawChunks.map((chunk) => {
          const input = buildEmbeddingInput(chunk);
          const hash = hashChunkInput(input);
          const embedding = this.embeddingCache.get(hash) ?? [];
          return {
            ...chunk,
            embedding,
            embeddingNorm: computeNorm(embedding),
            contentHash: hash,
          };
        });

        this.isIndexed = true;
        this.lastIndexedAt = new Date().toISOString();
      } finally {
        this.indexingPromise = null;
      }
    })();

    return this.indexingPromise;
  }

  public async addDocument(input: {
    title: string;
    category: string;
    author?: string;
    content: string;
  }): Promise<{ document: SourceDocument; chunksAdded: number }> {
    const cleanTitle = input.title.trim();
    const cleanContent = input.content.trim();
    if (!cleanTitle || !cleanContent) {
      const err = new Error('Document title and content are required.');
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const customCount = this.documents.filter((d) => !d.isDefault).length + 1;
    const newDoc: SourceDocument = {
      id: `doc-user-${Date.now().toString(36)}`,
      title: cleanTitle,
      category: input.category.trim() || 'User Document',
      docCode: `USR-DOC-${String(customCount).padStart(3, '0')}`,
      updatedAt: new Date().toISOString().slice(0, 10),
      author: input.author?.trim() || 'User Upload',
      isDefault: false,
      content: cleanContent,
    };

    const newChunks = chunkDocument(newDoc);
    if (newChunks.length === 0) {
      const err = new Error('Document did not produce any indexable text chunks.');
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const ai = getGeminiClient();
    const embedInputs = newChunks.map((c) => buildEmbeddingInput(c));
    const CONCURRENCY = 6;
    for (let i = 0; i < newChunks.length; i += CONCURRENCY) {
      const batchChunks = newChunks.slice(i, i + CONCURRENCY);
      const batchInputs = embedInputs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batchInputs.map((inputText) =>
          withRetry(() =>
            ai.models.embedContent({
              model: EMBEDDING_MODEL,
              contents: inputText,
            })
          )
        )
      );
      for (let j = 0; j < batchChunks.length; j++) {
        const values = results[j].embeddings?.[0]?.values;
        if (!values || values.length === 0) {
          throw new Error(`Failed to embed chunk ${batchChunks[j].id}`);
        }
        const hash = hashChunkInput(batchInputs[j]);
        this.embeddingCache.set(hash, values);
      }
    }
    this.saveCacheToDisk();

    this.documents.push(newDoc);
    this.isIndexed = false;
    await this.ensureIndexed(false);

    return { document: newDoc, chunksAdded: newChunks.length };
  }

  public async deleteDocument(docId: string): Promise<void> {
    const target = this.documents.find((d) => d.id === docId);
    if (!target) {
      const err = new Error('Document not found.');
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    this.documents = this.documents.filter((d) => d.id !== docId);
    this.indexedChunks = this.indexedChunks.filter((c) => c.docId !== docId);
  }

  public async restoreDefaults(): Promise<void> {
    const existingIds = new Set(this.documents.map((d) => d.id));
    for (const def of DEFAULT_DOCUMENTS) {
      if (!existingIds.has(def.id)) {
        this.documents.unshift(def);
      }
    }
    this.isIndexed = false;
    await this.ensureIndexed(false);
  }

  private async rewriteFollowUpQuery(
    ai: GoogleGenAI,
    query: string,
    history: ChatTurn[]
  ): Promise<string> {
    if (history.length === 0) {
      return query;
    }

    const recentTurns = history
      .slice(-4)
      .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
      .join('\n');

    const rewriteRes = await withRetry(() =>
      ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: `Given the recent conversation and the latest user question, rewrite the latest user question into a concise standalone search query ONLY if it relies on pronouns or omitted context from the previous turns. If the latest question is already self-contained or asks about a completely new topic, return it verbatim without adding words from earlier turns. Return only the query string.

Recent conversation:
${recentTurns}

Latest question: ${query}`,
      })
    );

    const rewritten = rewriteRes.text?.trim();
    return rewritten && rewritten.length > 0 ? rewritten : query;
  }

  private async rankTopChunks(
    ai: GoogleGenAI,
    searchQuery: string,
    topK: number,
    minSimilarity: number
  ): Promise<RetrievedChunk[]> {
    if (this.indexedChunks.length === 0) {
      return [];
    }

    const queryEmbedRes = await withRetry(() =>
      ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: searchQuery,
      })
    );
    const queryVector = queryEmbedRes.embeddings?.[0]?.values;
    if (!queryVector || queryVector.length === 0) {
      throw new Error('Failed to generate query embedding from gemini-embedding-2.');
    }
    const queryNorm = computeNorm(queryVector);

    const scored = this.indexedChunks
      .map((chunk) => ({
        chunk,
        similarity: cosineSimilarity(queryVector, queryNorm, chunk.embedding, chunk.embeddingNorm),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return scored.map((item, idx) => ({
      id: item.chunk.id,
      citationLabel: `C${idx + 1}`,
      docId: item.chunk.docId,
      docTitle: item.chunk.docTitle,
      docCode: item.chunk.docCode,
      category: item.chunk.category,
      sectionTitle: item.chunk.sectionTitle,
      chunkIndex: item.chunk.chunkIndex,
      totalChunksInDoc: item.chunk.totalChunksInDoc,
      text: item.chunk.text,
      similarity: Number(item.similarity.toFixed(4)),
      passedThreshold: item.similarity >= minSimilarity,
    }));
  }

  public async query(params: {
    query: string;
    history?: ChatTurn[];
    topK?: number;
    minSimilarity?: number;
  }): Promise<RagQueryResult> {
    const startMs = Date.now();
    const cleanQuery = params.query.trim();
    if (!cleanQuery) {
      const err = new Error('Query cannot be empty.');
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const topK = Math.min(Math.max(params.topK ?? 4, 1), 10);
    const minSimilarity = Math.min(Math.max(params.minSimilarity ?? 0.62, 0.1), 0.9);
    const history = params.history ?? [];

    await this.ensureIndexed(false);
    const ai = getGeminiClient();

    const standaloneQuery = await this.rewriteFollowUpQuery(ai, cleanQuery, history);
    const retrievedChunks = await this.rankTopChunks(ai, standaloneQuery, topK, minSimilarity);

    const fewShotBlock = FEW_SHOT_EXAMPLES.map(
      (ex, i) => `### Example ${i + 1}: ${ex.label}
Question: ${ex.userQuery}
<retrieved_context>
${ex.retrievedContextSnippet}
</retrieved_context>
Expected JSON:
${JSON.stringify(ex.expectedJson, null, 2)}`
    ).join('\n\n');

    const contextBlock =
      retrievedChunks.length > 0
        ? retrievedChunks
            .map((rc) => {
              const gateNote = rc.passedThreshold
                ? `similarity: ${rc.similarity.toFixed(3)}`
                : `similarity: ${rc.similarity.toFixed(3)} — BELOW THRESHOLD (${minSimilarity.toFixed(2)})`;
              return `[${rc.citationLabel} | ${rc.docCode} | ${rc.docTitle} | ${rc.sectionTitle} | ${gateNote}]\n${rc.text}`;
            })
            .join('\n\n')
        : 'NO DOCUMENTS INDEXED.';

    const historyBlock =
      history.length > 0
        ? `\n<recent_conversation>\n${history
            .slice(-4)
            .map((h) => `${h.role.toUpperCase()}: ${h.content}`)
            .join('\n')}\n</recent_conversation>\n`
        : '';

    const assembledUserPrompt = `Study these reference examples for grounding, inline citations, and abstention:

${fewShotBlock}
${historyBlock}
Now answer the active user question strictly from the retrieved context below.
If no passage passes the similarity threshold OR the retrieved passages do not explicitly answer the question, abstain with grounded=false and confidence="insufficient".

<retrieved_context>
${contextBlock}
</retrieved_context>

Active User Question: ${cleanQuery}`;

    const genRes = await withRetry(() =>
      ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: assembledUserPrompt,
        config: {
          systemInstruction: ENGINEERED_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description:
                  'Concise, accurate answer grounded strictly in <retrieved_context> with inline [C1], [C2] citations, or a clear abstention explanation if insufficient.',
              },
              grounded: {
                type: Type.BOOLEAN,
                description:
                  'True only if the answer is directly supported by facts in <retrieved_context>. False if abstaining.',
              },
              confidence: {
                type: Type.STRING,
                description: 'One of: high, medium, insufficient',
              },
              citedChunkIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of passage labels cited in the answer, e.g. ["C1", "C2"].',
              },
              abstentionReason: {
                type: Type.STRING,
                description:
                  'Empty string when grounded=true; concise reason why context was insufficient when grounded=false.',
              },
              suggestedFollowUps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '2 short follow-up questions strictly answerable from <retrieved_context> when grounded=true, or empty array when grounded=false.',
              },
            },
            required: [
              'answer',
              'grounded',
              'confidence',
              'citedChunkIds',
              'abstentionReason',
              'suggestedFollowUps',
            ],
          },
        },
      })
    );

    const rawText = (genRes.text ?? '').trim();
    if (!rawText) {
      throw new Error('Gemini returned an empty response payload.');
    }

    let parsed: {
      answer: string;
      grounded: boolean;
      confidence: string;
      citedChunkIds: string[];
      abstentionReason: string;
      suggestedFollowUps?: string[];
    };

    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Failed to parse structured JSON response from Gemini.');
    }

    const normalizedConfidence: 'high' | 'medium' | 'insufficient' =
      parsed.confidence === 'high' || parsed.confidence === 'medium'
        ? parsed.confidence
        : 'insufficient';

    const validLabels = new Set(retrievedChunks.map((c) => c.citationLabel));
    const citedChunkIds = Array.isArray(parsed.citedChunkIds)
      ? parsed.citedChunkIds.filter((id) => validLabels.has(id))
      : [];

    const isActuallyGrounded = Boolean(parsed.grounded) && citedChunkIds.length > 0;
    const suggestedFollowUps =
      isActuallyGrounded && Array.isArray(parsed.suggestedFollowUps)
        ? parsed.suggestedFollowUps
            .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
            .slice(0, 2)
        : [];

    const latencyMs = Date.now() - startMs;

    return {
      answer: parsed.answer,
      grounded: isActuallyGrounded,
      confidence: isActuallyGrounded
        ? normalizedConfidence === 'insufficient'
          ? 'medium'
          : normalizedConfidence
        : 'insufficient',
      citedChunkIds,
      abstentionReason: parsed.abstentionReason ?? '',
      suggestedFollowUps,
      retrievedChunks,
      promptTrace: {
        model: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
        standaloneQuery,
        topK,
        minSimilarity,
        systemInstruction: ENGINEERED_SYSTEM_INSTRUCTION,
        fewShotExamplesCount: FEW_SHOT_EXAMPLES.length,
        assembledUserPrompt,
        latencyMs,
      },
    };
  }

  public async reviewCodeWithRag(params: {
    code: string;
    language?: string;
    focus?: string;
    topK?: number;
    minSimilarity?: number;
  }): Promise<CodeReviewResult> {
    const startMs = Date.now();
    const cleanCode = params.code.trim();
    if (!cleanCode) {
      const err = new Error('Code snippet cannot be empty.');
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const language = (params.language ?? 'TypeScript').trim();
    const focus = (params.focus ?? 'Full Review').trim();
    const topK = Math.min(Math.max(params.topK ?? 5, 1), 10);
    const minSimilarity = Math.min(Math.max(params.minSimilarity ?? 0.52, 0.1), 0.9);

    await this.ensureIndexed(false);
    const ai = getGeminiClient();

    const searchQuery = `Code review standards for ${language} (${focus}):\n${cleanCode.slice(0, 1200)}`;
    const retrievedChunks = await this.rankTopChunks(ai, searchQuery, topK, minSimilarity);

    const contextBlock =
      retrievedChunks.length > 0
        ? retrievedChunks
            .map(
              (rc) =>
                `[${rc.citationLabel} | ${rc.docCode} | ${rc.docTitle} | ${rc.sectionTitle} | similarity: ${rc.similarity.toFixed(3)}]\n${rc.text}`
            )
            .join('\n\n')
        : 'NO ENGINEERING STANDARDS INDEXED.';

    const assembledUserPrompt = `Perform a structured ${focus} code review of this ${language} snippet.
Cross-check the code against the retrieved engineering standards below and cite relevant passage labels ([C1], [C2], etc.) in your findings.

<retrieved_context>
${contextBlock}
</retrieved_context>

<submitted_code language="${language}">
${cleanCode}
</submitted_code>`;

    const genRes = await withRetry(() =>
      ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: assembledUserPrompt,
        config: {
          systemInstruction: CODE_REVIEW_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallStatus: {
                type: Type.STRING,
                description: 'One of: pass, needs_changes, critical_issues',
              },
              summary: {
                type: Type.STRING,
                description: 'Concise 2-3 sentence summary of the code review findings.',
              },
              findings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: {
                      type: Type.STRING,
                      description: 'One of: critical, warning, info',
                    },
                    title: {
                      type: Type.STRING,
                      description: 'Short title of the issue or verification.',
                    },
                    lineHint: {
                      type: Type.STRING,
                      description: 'Line number or symbol hint in the submitted code.',
                    },
                    detail: {
                      type: Type.STRING,
                      description: 'Explanation referencing [C1]/[C2] citations when applicable.',
                    },
                    recommendation: {
                      type: Type.STRING,
                      description: 'Concrete fix or improvement.',
                    },
                    citedChunkIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: [
                    'severity',
                    'title',
                    'lineHint',
                    'detail',
                    'recommendation',
                    'citedChunkIds',
                  ],
                },
              },
            },
            required: ['overallStatus', 'summary', 'findings'],
          },
        },
      })
    );

    const rawText = (genRes.text ?? '').trim();
    if (!rawText) {
      throw new Error('Gemini returned an empty code review response.');
    }

    let parsed: {
      overallStatus: string;
      summary: string;
      findings: CodeReviewFinding[];
    };

    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Failed to parse structured JSON code review output.');
    }

    const validLabels = new Set(retrievedChunks.map((c) => c.citationLabel));
    const citedSet = new Set<string>();
    const cleanFindings: CodeReviewFinding[] = (parsed.findings ?? []).map((f) => {
      const sev: 'critical' | 'warning' | 'info' =
        f.severity === 'critical' || f.severity === 'warning' ? f.severity : 'info';
      const cited = Array.isArray(f.citedChunkIds)
        ? f.citedChunkIds.filter((id) => validLabels.has(id))
        : [];
      for (const c of cited) citedSet.add(c);
      return {
        severity: sev,
        title: f.title,
        lineHint: f.lineHint,
        detail: f.detail,
        recommendation: f.recommendation,
        citedChunkIds: cited,
      };
    });

    const normalizedStatus: 'pass' | 'needs_changes' | 'critical_issues' =
      parsed.overallStatus === 'pass' || parsed.overallStatus === 'critical_issues'
        ? parsed.overallStatus
        : 'needs_changes';

    return {
      overallStatus: normalizedStatus,
      summary: parsed.summary,
      findings: cleanFindings,
      citedChunkIds: Array.from(citedSet),
      retrievedChunks,
      promptTrace: {
        model: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
        standaloneQuery: `${language} · ${focus}`,
        topK,
        minSimilarity,
        systemInstruction: CODE_REVIEW_SYSTEM_INSTRUCTION,
        fewShotExamplesCount: 0,
        assembledUserPrompt,
        latencyMs: Date.now() - startMs,
      },
    };
  }

  public async generateCodeFixWithRag(params: {
    code: string;
    language?: string;
    findings: CodeReviewFinding[];
    retrievedChunks: RetrievedChunk[];
  }): Promise<CodeFixResult> {
    const startMs = Date.now();
    const cleanCode = params.code.trim();
    if (!cleanCode) {
      const err = new Error('Code snippet cannot be empty.');
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const language = (params.language ?? 'TypeScript').trim();
    const ai = getGeminiClient();

    const standardsText = (params.retrievedChunks ?? [])
      .map((c) => `[${c.citationLabel} | ${c.docCode}] ${c.text}`)
      .join('\n\n');

    const findingsText = (params.findings ?? [])
      .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}: ${f.recommendation}`)
      .join('\n');

    const prompt = `Rewrite the submitted ${language} code to fix every review finding below while complying strictly with the referenced standards.

<standards>
${standardsText || 'Apply best security, type-safety, and error-handling practices.'}
</standards>

<review_findings>
${findingsText || 'Ensure clean, production-grade code.'}
</review_findings>

<original_code>
${cleanCode}
</original_code>`;

    const genRes = await withRetry(() =>
      ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a senior software engineer producing clean, minimal, production-ready refactored code that resolves all cited review findings without placeholders.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fixedCode: {
                type: Type.STRING,
                description: 'Complete corrected source code ready to copy and run.',
              },
              changeSummary: {
                type: Type.STRING,
                description: 'Concise 1-2 sentence summary of the fixes applied.',
              },
            },
            required: ['fixedCode', 'changeSummary'],
          },
        },
      })
    );

    const rawText = (genRes.text ?? '').trim();
    if (!rawText) {
      throw new Error('Gemini returned an empty code-fix payload.');
    }

    const parsed = JSON.parse(rawText) as { fixedCode: string; changeSummary: string };
    return {
      fixedCode: parsed.fixedCode,
      changeSummary: parsed.changeSummary,
      latencyMs: Date.now() - startMs,
    };
  }

  public async addDocumentFromUrl(params: {
    url: string;
    title?: string;
    category?: string;
  }): Promise<{ document: SourceDocument; chunksAdded: number }> {
    const rawUrl = params.url.trim();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      const err = new Error('Please enter a valid URL starting with https:// or http://');
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      const err = new Error('Only http:// and https:// URLs are supported.');
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const res = await fetch(parsedUrl.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'text/plain, text/markdown, text/html, application/json' },
    });

    if (!res.ok) {
      const err = new Error(`Failed to fetch URL (HTTP ${res.status}).`);
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const contentType = res.headers.get('content-type') ?? '';
    let bodyText = await res.text();
    if (bodyText.length > 250_000) {
      bodyText = bodyText.slice(0, 250_000);
    }

    if (contentType.includes('text/html')) {
      bodyText = bodyText
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (!bodyText.trim()) {
      const err = new Error('The fetched URL did not return readable text content.');
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const fallbackTitle =
      parsedUrl.pathname.split('/').filter(Boolean).pop() || parsedUrl.hostname;

    return this.addDocument({
      title: params.title?.trim() || fallbackTitle,
      category: params.category?.trim() || 'Web Import',
      author: parsedUrl.hostname,
      content: bodyText,
    });
  }

  public async semanticSearch(params: {
    query: string;
    topK?: number;
    minSimilarity?: number;
  }): Promise<SemanticSearchResult> {
    const startMs = Date.now();
    const cleanQuery = params.query.trim();
    if (!cleanQuery) {
      const err = new Error('Search query cannot be empty.');
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const topK = Math.min(Math.max(params.topK ?? 6, 1), 15);
    const minSimilarity = Math.min(Math.max(params.minSimilarity ?? 0.55, 0.1), 0.9);

    await this.ensureIndexed(false);
    const ai = getGeminiClient();
    const results = await this.rankTopChunks(ai, cleanQuery, topK, minSimilarity);

    return {
      query: cleanQuery,
      results,
      latencyMs: Date.now() - startMs,
    };
  }

  public async summarizeDocument(docId: string): Promise<DocumentBriefResult> {
    const startMs = Date.now();
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) {
      const err = new Error('Document not found.');
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const ai = getGeminiClient();
    const prompt = `Summarize this document strictly using facts in the text below.
Return exactly 3 concise executive summary bullets (preserving exact numeric limits, timeouts, headers, or rule IDs) and 3 suggested test questions that a user could verify from this document.

<document title="${doc.title}" code="${doc.docCode}">
${doc.content.slice(0, 12000)}
</document>`;

    const genRes = await withRetry(() =>
      ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a technical documentation analyst. Summarize strictly from the provided document without adding outside claims.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryBullets: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 concise grounded summary bullets.',
              },
              suggestedQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 concrete questions directly answerable from this document.',
              },
            },
            required: ['summaryBullets', 'suggestedQuestions'],
          },
        },
      })
    );

    const rawText = (genRes.text ?? '').trim();
    if (!rawText) {
      throw new Error('Gemini returned an empty document brief.');
    }
    const parsed = JSON.parse(rawText) as {
      summaryBullets: string[];
      suggestedQuestions: string[];
    };

    return {
      docId: doc.id,
      summaryBullets: (parsed.summaryBullets ?? []).slice(0, 4),
      suggestedQuestions: (parsed.suggestedQuestions ?? []).slice(0, 3),
      latencyMs: Date.now() - startMs,
    };
  }
}

export const ragStore = new RagVectorStore();
export { formatApiError };
