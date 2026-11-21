import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import type {
  DocumentBriefResult,
  DocumentChunkItem,
  SemanticSearchResult,
  SourceDocument,
} from '../types/rag';

interface KnowledgeBaseViewProps {
  documents: SourceDocument[];
  chunks: DocumentChunkItem[];
  selectedDocId: string | null;
  onSelectDoc: (docId: string) => void;
  onOpenAddDocument: () => void;
  onDeleteDocument: (docId: string) => void;
  onRestoreDefaults: () => void;
  onAskQuestion: (question: string) => void;
}

export function KnowledgeBaseView({
  documents,
  chunks,
  selectedDocId,
  onSelectDoc,
  onOpenAddDocument,
  onDeleteDocument,
  onRestoreDefaults,
  onAskQuestion,
}: KnowledgeBaseViewProps) {
  const [chunkSearch, setChunkSearch] = useState('');
  const [viewMode, setViewMode] = useState<'chunks' | 'raw' | 'semantic'>('chunks');

  // AI Document Brief state keyed by docId
  const [briefByDoc, setBriefByDoc] = useState<Record<string, DocumentBriefResult>>({});
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Cross-Document Semantic Vector Search state
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [semanticResult, setSemanticResult] = useState<SemanticSearchResult | null>(null);

  const activeDoc =
    documents.find((d) => d.id === selectedDocId) ?? documents[0] ?? null;

  const docChunks = useMemo(() => {
    if (!activeDoc) return [];
    const base = chunks.filter((c) => c.docId === activeDoc.id);
    const q = chunkSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.text.toLowerCase().includes(q) ||
        c.sectionTitle.toLowerCase().includes(q)
    );
  }, [activeDoc, chunks, chunkSearch]);

  const activeBrief = activeDoc ? briefByDoc[activeDoc.id] : undefined;

  const handleGenerateBrief = async () => {
    if (!activeDoc || briefLoading) return;
    setBriefLoading(true);
    setBriefError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(activeDoc.id)}/brief`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate document brief.');
      }
      setBriefByDoc((prev) => ({ ...prev, [activeDoc.id]: data as DocumentBriefResult }));
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Unable to summarize document.');
    } finally {
      setBriefLoading(false);
    }
  };

  const handleRunSemanticSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!semanticQuery.trim() || semanticLoading) return;
    setSemanticLoading(true);
    setSemanticError(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: semanticQuery.trim(),
          topK: 6,
          minSimilarity: 0.52,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Semantic search failed.');
      }
      setSemanticResult(data as SemanticSearchResult);
    } catch (err) {
      setSemanticError(err instanceof Error ? err.message : 'Vector search failed.');
    } finally {
      setSemanticLoading(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#f4f6f7] dark:bg-[#090d14] p-6 transition-colors">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              Knowledge Base &amp; Vector Explorer
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Inspect indexed chunks, generate grounded executive briefs, or run live cosine-similarity vector searches across every source.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRestoreDefaults}
              className="px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#0f1520] border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Restore Defaults
            </button>
            <button
              type="button"
              onClick={onOpenAddDocument}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Source</span>
            </button>
          </div>
        </div>

        {/* Document Selector Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.map((doc, idx) => {
            const count = chunks.filter((c) => c.docId === doc.id).length;
            const isActive = activeDoc?.id === doc.id;
            return (
              <motion.button
                key={doc.id}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => onSelectDoc(doc.id)}
                className={`text-left p-4 rounded-xl border transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-[#0f1520] border-teal-600 dark:border-teal-500 shadow-xs'
                    : 'bg-white dark:bg-[#0f1520] border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-mono text-teal-700 dark:text-teal-400 mb-1">
                  <span>{doc.docCode}</span>
                  <span className="font-sans text-zinc-500 dark:text-zinc-400">{doc.category}</span>
                </div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-white line-clamp-1">
                  {doc.title}
                </div>
                <div className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {count} passages · {doc.content.length.toLocaleString()} chars
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Active Document Inspector + AI Brief + Semantic Search */}
        {activeDoc && (
          <section className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  <span className="text-teal-700 dark:text-teal-400">{activeDoc.docCode}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans">{activeDoc.author}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans">Updated {activeDoc.updatedAt}</span>
                </div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
                  {activeDoc.title}
                </h2>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('chunks')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      viewMode === 'chunks'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Indexed Passages
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('semantic')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      viewMode === 'semantic'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Vector Search
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('raw')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      viewMode === 'raw'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Full Text
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateBrief}
                  disabled={briefLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 rounded-md transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {briefLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <BookOpenCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{briefLoading ? 'Summarizing…' : 'Generate AI Brief'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteDocument(activeDoc.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-md transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* AI Document Executive Brief & Suggested Questions */}
            {(activeBrief || briefError) && (
              <div className="px-6 py-4 bg-teal-50/45 dark:bg-teal-950/25 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
                {briefError ? (
                  <p className="text-xs text-red-700 dark:text-red-300">{briefError}</p>
                ) : (
                  activeBrief && (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-teal-800 dark:text-teal-300">
                          Grounded Executive Brief
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {(activeBrief.latencyMs / 1000).toFixed(1)}s
                        </span>
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                        {activeBrief.summaryBullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                      {activeBrief.suggestedQuestions.length > 0 && (
                        <div className="pt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Test in Assistant:
                          </span>
                          {activeBrief.suggestedQuestions.map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => onAskQuestion(q)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-800 dark:text-teal-300 bg-white dark:bg-zinc-900 hover:bg-teal-50 dark:hover:bg-zinc-800 border border-teal-200 dark:border-teal-800 rounded-md transition-colors cursor-pointer text-left"
                            >
                              <span>{q}</span>
                              <ArrowRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )
                )}
              </div>
            )}

            {viewMode === 'semantic' ? (
              <div className="p-6 space-y-4">
                <form onSubmit={handleRunSemanticSearch} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search
                      className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={semanticQuery}
                      onChange={(e) => setSemanticQuery(e.target.value)}
                      placeholder="Search by meaning across ALL documents (e.g., retry delay for rate limits)..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 dark:bg-[#090d14] border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={semanticLoading || !semanticQuery.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {semanticLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Vector Search</span>
                  </button>
                </form>

                {semanticError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{semanticError}</p>
                )}

                {semanticResult && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      <span>
                        Top {semanticResult.results.length} semantic matches across workspace
                      </span>
                      <span>{(semanticResult.latencyMs / 1000).toFixed(2)}s</span>
                    </div>
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                      {semanticResult.results.map((r, idx) => {
                        const pct = Math.max(0, Math.min(100, Math.round(r.similarity * 100)));
                        return (
                          <div key={r.id} className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                                  #{idx + 1} · {r.docCode}
                                </span>
                                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                  {r.docTitle} — {r.sectionTitle}
                                </span>
                              </div>
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums shrink-0">
                                {pct}% match
                              </span>
                            </div>
                            <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: pct / 100 }}
                                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                style={{ transformOrigin: 'left' }}
                                className="h-full w-full bg-teal-600 dark:bg-teal-400 rounded-full"
                              />
                            </div>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {r.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : viewMode === 'chunks' ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative w-full max-w-sm">
                    <Search
                      className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={chunkSearch}
                      onChange={(e) => setChunkSearch(e.target.value)}
                      placeholder="Filter this document's passages..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    Showing {docChunks.length} of{' '}
                    {chunks.filter((c) => c.docId === activeDoc.id).length} passages
                  </div>
                </div>

                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  {docChunks.map((chunk) => (
                    <div key={chunk.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                            Passage {chunk.chunkIndex}/{chunk.totalChunksInDoc}
                          </span>
                          <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                            ·
                          </span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {chunk.sectionTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                          <span>{chunk.charCount} chars</span>
                          <span aria-hidden="true">·</span>
                          {chunk.indexed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Indexed</span>
                            </span>
                          ) : (
                            <span>Pending embed</span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {chunk.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Raw Source ({activeDoc.content.length} characters)</span>
                </div>
                <pre className="p-4 bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {activeDoc.content}
                </pre>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
