export interface SourceDocument {
  id: string;
  title: string;
  category: string;
  docCode: string;
  updatedAt: string;
  author: string;
  isDefault: boolean;
  content: string;
}

export interface DocumentChunk {
  id: string;
  docId: string;
  docTitle: string;
  docCode: string;
  category: string;
  sectionTitle: string;
  chunkIndex: number;
  totalChunksInDoc: number;
  charCount: number;
  text: string;
}

export const DEFAULT_DOCUMENTS: SourceDocument[] = [
  {
    id: 'doc-sec-01',
    title: 'Security, Auth & Secrets Handling Standard',
    category: 'Security',
    docCode: 'SL-SEC-101',
    updatedAt: '2026-10-18',
    author: 'StackLens Security Architecture',
    isDefault: true,
    content: `# StackLens Security, Auth & Secrets Handling Standard

## 1.1 Token Lifetimes and Rotation
All authenticated web sessions in StackLens services must issue short-lived JWT access tokens with a strict maximum TTL of 900 seconds (15 minutes). Refresh tokens expire after 7 days and must undergo single-use rotation on every renewal; reusing a rotated refresh token immediately revokes the entire token family.

## 1.2 Mandatory Trace Header and Server-Only Keys
Every API request between client and backend under /api/* must propagate the correlation header X-StackLens-Trace-Id (UUID v4) for auditability.
Third-party model credentials—specifically GEMINI_API_KEY and database connection strings—must never appear in client bundles, Vite define blocks, or browser fetch payloads. All LLM and embedding SDK calls must execute exclusively inside server-side route handlers.

## 1.3 Input Sanitization and CORS Policy
User-supplied code snippets and document uploads must be validated for byte length before invoking downstream AI providers. Production Express servers must enforce an explicit origin allowlist and never reflect wildcard Access-Control-Allow-Origin headers on credentialed routes.`,
  },
  {
    id: 'doc-api-02',
    title: 'API Gateway, Rate Limits & Error Contracts',
    category: 'Backend API',
    docCode: 'SL-API-204',
    updatedAt: '2026-10-22',
    author: 'Core Platform Team',
    isDefault: true,
    content: `# API Gateway, Rate Limits & Error Contracts

## 2.1 Payload Caps and Streaming Heartbeats
Standard JSON endpoints under /api/* enforce a maximum request body limit of 512 KB unless explicitly overridden for bulk document ingestion (capped at 2 MB). Server-Sent Events (SSE) endpoints streaming code review output must emit a keep-alive heartbeat comment every 15 seconds to prevent proxy idle disconnects.

## 2.2 Retry Backoff and Upstream Resilience
When calling external inference APIs that return transient HTTP 429 (RESOURCE_EXHAUSTED) or 503 (UNAVAILABLE) errors, backend services must apply exponential backoff starting at a base delay of 450 ms, doubling per attempt up to a maximum of 3 retries. Never mask an upstream API failure with fabricated or mocked response text.

## 2.3 Canonical JSON Error Envelope
All non-2xx API responses must return a structured JSON payload containing three mandatory keys: error (human-readable diagnostic message), code (machine-readable uppercase identifier such as MISSING_API_KEY or VALIDATION_FAILED), and traceId. Schema validation rejections must return HTTP 422.`,
  },
  {
    id: 'doc-perf-03',
    title: 'Database, Caching & Latency Budgets',
    category: 'Performance',
    docCode: 'SL-PRF-309',
    updatedAt: '2026-09-29',
    author: 'Systems Reliability Group',
    isDefault: true,
    content: `# Database, Caching & Latency Budgets

## 3.1 Query Timeouts and Connection Pooling
Every relational database query in StackLens backend services must enforce a statement timeout of 3,500 ms. Worker instances are capped at a maximum connection pool size of 18 connections to avoid exhausting managed PostgreSQL slots under burst traffic.

## 3.2 Embedding Cache and N+1 Prevention
Computed vector embeddings are deterministic per model and chunk hash and must be cached by SHA-256 content digest rather than re-computed on every server restart. Route handlers servicing list views must execute at most 2 database round-trips per request; unbounded N+1 query loops inside array maps are classified as a Critical review blocker.

## 3.3 Service Latency SLAs
Non-LLM CRUD endpoints must meet a P95 response latency target below 400 ms. Read-heavy metadata endpoints may use an in-memory or Redis cache with a 120-second TTL.`,
  },
  {
    id: 'doc-fe-04',
    title: 'TypeScript, React & UI Engineering Guide',
    category: 'Frontend',
    docCode: 'SL-FE-412',
    updatedAt: '2026-11-01',
    author: 'Frontend Guild',
    isDefault: true,
    content: `# TypeScript, React & UI Engineering Guide

## 4.1 Type Safety and Zero-Any Boundaries
All TypeScript modules must pass tsc --noEmit with zero errors prior to merge. Explicit any annotations in API response parsers and shared state hooks are prohibited; define typed interfaces or narrow unknown inputs with runtime type guards.

## 4.2 Async Effects and Cancellation
React data-fetching hooks triggered by user navigation or search input must cancel stale in-flight requests using AbortController or an active-flag guard in useEffect cleanup to prevent out-of-order state overwrites. Never call window.alert or window.open inside embedded workspace views; use accessible in-app dialogs or standard anchor links.

## 4.3 Accessibility and Visual Restraint
Interactive buttons and controls must maintain at least a 40px touch target height and visible focus-visible outlines. Semantic states (success, warning, error) must always pair color with an explicit text label or icon rather than relying on hue alone.`,
  },
  {
    id: 'doc-rag-05',
    title: 'StackLens RAG & Prompt Calibration Spec',
    category: 'Architecture',
    docCode: 'SL-RAG-501',
    updatedAt: '2026-11-10',
    author: 'Platform Search Team',
    isDefault: true,
    content: `# StackLens RAG & Prompt Calibration Spec

## 5.1 Document Chunking and Embedding Model
Source documents and uploaded code files are segmented at heading and paragraph boundaries targeting 520 characters per chunk with a 95-character sliding overlap. All chunks and retrieval queries are embedded using gemini-embedding-2 (3,072-dimensional vectors) and ranked by cosine similarity.

## 5.2 Grounding Threshold and Citation Mandate
The default retrieval similarity gate is 0.62. Prompts sent to gemini-3.1-flash-lite must include few-shot grounding and abstention examples alongside a strict JSON responseSchema. Every factual claim must carry an inline passage citation such as [C1] or [C2]; if retrieved passages do not explicitly verify the query, the assistant must abstain with grounded set to false.`,
  },
];

const TARGET_CHUNK_CHARS = 520;
const CHUNK_OVERLAP_CHARS = 95;

export function chunkDocument(doc: SourceDocument): DocumentChunk[] {
  const lines = doc.content.split('\n');
  const sections: Array<{ sectionTitle: string; body: string }> = [];

  let currentSection = doc.title;
  let buffer: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('## ')) {
      if (buffer.length > 0) {
        const text = buffer.join('\n').trim();
        if (text) {
          sections.push({ sectionTitle: currentSection, body: text });
        }
        buffer = [];
      }
      currentSection = trimmed.replace(/^##\s+/, '').trim();
    } else if (trimmed.startsWith('# ')) {
      const docHeading = trimmed.replace(/^#\s+/, '').trim();
      if (!currentSection) {
        currentSection = docHeading;
      }
    } else {
      buffer.push(rawLine);
    }
  }

  if (buffer.length > 0) {
    const text = buffer.join('\n').trim();
    if (text) {
      sections.push({ sectionTitle: currentSection, body: text });
    }
  }

  if (sections.length === 0 && doc.content.trim().length > 0) {
    sections.push({ sectionTitle: doc.title, body: doc.content.trim() });
  }

  const rawChunks: Array<{ sectionTitle: string; text: string }> = [];

  for (const section of sections) {
    const paragraphs = section.body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    let currentChunk = '';

    for (const para of paragraphs) {
      if (para.length > TARGET_CHUNK_CHARS) {
        if (currentChunk.trim()) {
          rawChunks.push({ sectionTitle: section.sectionTitle, text: currentChunk.trim() });
          currentChunk = '';
        }
        const sentences = para.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [para];
        let sentenceBuf = '';
        for (const sent of sentences) {
          if (sentenceBuf.length + sent.length > TARGET_CHUNK_CHARS && sentenceBuf.trim()) {
            rawChunks.push({ sectionTitle: section.sectionTitle, text: sentenceBuf.trim() });
            const overlapTail = sentenceBuf.trim().slice(-CHUNK_OVERLAP_CHARS);
            sentenceBuf = `${overlapTail} ${sent}`.trim();
          } else {
            sentenceBuf = sentenceBuf ? `${sentenceBuf} ${sent.trim()}` : sent.trim();
          }
        }
        if (sentenceBuf.trim()) {
          rawChunks.push({ sectionTitle: section.sectionTitle, text: sentenceBuf.trim() });
        }
        continue;
      }

      const candidate = currentChunk ? `${currentChunk}\n\n${para}` : para;
      if (candidate.length > TARGET_CHUNK_CHARS && currentChunk.trim()) {
        rawChunks.push({ sectionTitle: section.sectionTitle, text: currentChunk.trim() });
        const overlapTail = currentChunk.trim().slice(-CHUNK_OVERLAP_CHARS);
        currentChunk = `${overlapTail}\n\n${para}`;
      } else {
        currentChunk = candidate;
      }
    }

    if (currentChunk.trim()) {
      rawChunks.push({ sectionTitle: section.sectionTitle, text: currentChunk.trim() });
    }
  }

  return rawChunks.map((rc, idx) => ({
    id: `${doc.id}::c${idx + 1}`,
    docId: doc.id,
    docTitle: doc.title,
    docCode: doc.docCode,
    category: doc.category,
    sectionTitle: rc.sectionTitle,
    chunkIndex: idx + 1,
    totalChunksInDoc: rawChunks.length,
    charCount: rc.text.length,
    text: rc.text,
  }));
}
