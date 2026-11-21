import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  Eye,
  Loader2,
  Moon,
  PanelRight,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sun,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../types/rag';
import { FormattedAnswer } from './FormattedAnswer';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  errorMessage: string | null;
  lastFailedQuery: string | null;
  topK: number;
  minSimilarity: number;
  selectedMessageId: string | null;
  isInspectorOpen: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onToggleInspector: () => void;
  onOpenCodeReviewer: () => void;
  onOpenAddDocument: () => void;
  onInputChange: (val: string) => void;
  onSubmitQuery: (query: string) => void;
  onRetry: () => void;
  onClearChat: () => void;
  onChangeTopK: (k: number) => void;
  onChangeMinSimilarity: (sim: number) => void;
  onSelectMessage: (msgId: string) => void;
  onCitationClick: (msgId: string, citationLabel: string) => void;
}

const STARTER_QUESTIONS = [
  {
    label: 'Security & Token Policy',
    prompt:
      'What is the maximum JWT access token TTL, and what correlation header must /api/* requests include?',
  },
  {
    label: 'Database & Error Contracts',
    prompt:
      'What SQL statement timeout applies to backend queries, and what JSON fields and retry backoff base are required on upstream errors?',
  },
  {
    label: 'Out-of-Scope Safety Check',
    prompt:
      'What is the capital city of France, and what is rule SL-K8S-999 in the Kubernetes deployment guide?',
  },
];

const PIPELINE_STEPS = [
  'Embedding query via gemini-embedding-2',
  'Ranking passages by cosine similarity',
  'Synthesizing grounded answer & citations',
];

export function ChatWorkspace({
  messages,
  inputValue,
  isLoading,
  errorMessage,
  lastFailedQuery,
  topK,
  minSimilarity,
  selectedMessageId,
  isInspectorOpen,
  isDark,
  onToggleTheme,
  onToggleInspector,
  onOpenCodeReviewer,
  onOpenAddDocument,
  onInputChange,
  onSubmitQuery,
  onRetry,
  onClearChat,
  onChangeTopK,
  onChangeMinSimilarity,
  onSelectMessage,
  onCitationClick,
}: ChatWorkspaceProps) {
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activePipelineStep, setActivePipelineStep] = useState(0);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setActivePipelineStep(0);
      return;
    }
    const t1 = setTimeout(() => setActivePipelineStep(1), 500);
    const t2 = setTimeout(() => setActivePipelineStep(2), 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isLoading]);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onSubmitQuery(inputValue.trim());
  };

  const handleCopyAnswer = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleExportThread = () => {
    if (messages.length === 0) return;
    const md = messages
      .map((m) => {
        if (m.role === 'user') return `### User\n${m.content}\n`;
        const cites = m.ragResult?.retrievedChunks
          .filter((c) => m.ragResult?.citedChunkIds.includes(c.citationLabel))
          .map(
            (c) =>
              `- **[${c.citationLabel}]** ${c.docTitle} (${c.docCode}, ${Math.round(c.similarity * 100)}% match)`
          )
          .join('\n');
        return `### StackLens\n${m.content}\n${cites ? `\n**References:**\n${cites}\n` : ''}`;
      })
      .join('\n---\n\n');

    const blob = new Blob([`# StackLens — Session Export\n\n${md}`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stacklens-session-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full bg-[#f4f6f7] dark:bg-[#090d14] transition-colors">
      {/* Compact Workspace Sub-bar */}
      <div className="px-6 py-2.5 bg-white dark:bg-[#0f1520] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            Grounded Assistant
          </span>
          <span aria-hidden="true">·</span>
          <span>Answers strictly verified against indexed workspace sources</span>
        </div>

        <div className="flex items-center gap-2.5 text-xs flex-wrap">
          <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
            <span>Passages</span>
            <select
              value={topK}
              onChange={(e) => onChangeTopK(Number(e.target.value))}
              className="px-2 py-1 bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:border-teal-600"
            >
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={6}>6</option>
              <option value={8}>8</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
            <span>Strictness</span>
            <select
              value={minSimilarity}
              onChange={(e) => onChangeMinSimilarity(Number(e.target.value))}
              className="px-2 py-1 bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:border-teal-600"
            >
              <option value={0.5}>Relaxed (0.50)</option>
              <option value={0.62}>Balanced (0.62)</option>
              <option value={0.7}>Strict (0.70)</option>
              <option value={0.78}>Exact (0.78)</option>
            </select>
          </label>

          {messages.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportThread}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3 h-3" aria-hidden="true" />
                <span>Export</span>
              </button>

              <button
                type="button"
                onClick={onClearChat}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>New Chat</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="md:hidden inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md cursor-pointer"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onToggleInspector}
            className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
              isInspectorOpen
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                : 'bg-white dark:bg-[#0f1520] text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <PanelRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isInspectorOpen ? 'Hide Evidence' : 'Show Evidence'}</span>
          </button>
        </div>
      </div>

      {/* Chat Stream */}
      <div className="flex-1 overflow-y-auto px-6 py-7 bg-[radial-gradient(ellipse_at_top,_rgba(13,148,136,0.06),transparent_60%)]">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <section className="py-4 space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-3 max-w-2xl"
              >
                <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white text-balance leading-tight">
                  Grounded knowledge and code intelligence in one workspace
                </h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Query your engineering standards, uploaded source code, and imported URLs with verified citations and automatic follow-up paths—or switch to the <strong className="text-zinc-900 dark:text-zinc-200">Code Reviewer</strong> to audit code and generate one-click fixes.
                </p>
              </motion.div>
            {/* Action Quick Launchers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                  onClick={onOpenCodeReviewer}
                  className="group text-left p-5 bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 hover:border-teal-600 dark:hover:border-teal-500 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                      <Code2 className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <ArrowRight
                      className="w-4 h-4 text-zinc-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Audit &amp; Auto-Fix Code
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                    Run a RAG-grounded audit with interactive line diffs, grounded fixes, or open your external AI-4 reviewer directly.
                  </p>
                </motion.button>

                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  onClick={onOpenAddDocument}
                  className="group text-left p-5 bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 hover:border-teal-600 dark:hover:border-teal-500 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <ArrowRight
                      className="w-4 h-4 text-zinc-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Add Code, Docs, or Import URL
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                    Paste specs, upload TypeScript/Python/SQL files, or ingest any public documentation URL into the vector index.
                  </p>
                </motion.button>
              </div>

              {/* Starter Questions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Try a grounded question</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {STARTER_QUESTIONS.map((item, idx) => (
                    <motion.button
                      key={item.label}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: 0.14 + idx * 0.04,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      onClick={() => onSubmitQuery(item.prompt)}
                      disabled={isLoading}
                      className="group text-left p-4 bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 hover:border-teal-600 dark:hover:border-teal-500 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-150 cursor-pointer disabled:opacity-50 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                          {item.label}
                        </div>
                        <div className="text-sm text-zinc-900 dark:text-zinc-100 leading-snug">
                          {item.prompt}
                        </div>
                      </div>
                      <ArrowRight
                        className="w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover:text-teal-600 dark:group-hover:text-teal-400 shrink-0 transition-colors"
                        aria-hidden="true"
                      />
                    </motion.button>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="flex justify-end"
                  >
                    <div className="max-w-xl bg-teal-600 dark:bg-teal-700 text-white px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed shadow-xs">
                      {msg.content}
                    </div>
                  </motion.div>
                );
              }

              const rag = msg.ragResult;
              const isSelected = selectedMessageId === msg.id;

              return (
                <motion.article
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`bg-white dark:bg-[#0f1520] border rounded-xl p-5 space-y-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors ${
                    isSelected
                      ? 'border-teal-400 dark:border-teal-600'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {rag && (
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800 text-xs flex-wrap">
                      <div className="flex items-center gap-2">
                        {rag.grounded ? (
                          <>
                            <CheckCircle2
                              className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              Verified from Sources
                            </span>
                            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                              ·
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-400 tabular-nums">
                              {rag.citedChunkIds.length} citation
                              {rag.citedChunkIds.length === 1 ? '' : 's'}
                            </span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert
                              className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              Not Covered in Knowledge Base
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyAnswer(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectMessage(msg.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isSelected ? 'Viewing Evidence' : 'View Evidence'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <FormattedAnswer
                    text={msg.content}
                    onCitationClick={(label) => onCitationClick(msg.id, label)}
                  />

                  {rag && !rag.grounded && rag.abstentionReason && (
                    <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Why it abstained:{' '}
                      </span>
                      {rag.abstentionReason}
                    </div>
                  )}

                  {rag && rag.citedChunkIds.length > 0 && (
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        References:
                      </span>
                      {rag.retrievedChunks
                        .filter((c) => rag.citedChunkIds.includes(c.citationLabel))
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onCitationClick(msg.id, c.citationLabel)}
                            className="inline-flex items-center gap-1.5 hover:text-teal-700 dark:hover:text-teal-400 transition-colors cursor-pointer tabular-nums"
                          >
                            <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                              [{c.citationLabel}]
                            </span>
                            <span className="text-zinc-700 dark:text-zinc-300">
                              {c.docTitle}
                            </span>
                            <span className="text-zinc-400 dark:text-zinc-500">
                              ({Math.round(c.similarity * 100)}% match)
                            </span>
                          </button>
                        ))}
                    </div>
                  )}

                  {rag && rag.suggestedFollowUps && rag.suggestedFollowUps.length > 0 && (
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                      <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        Explore related questions
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {rag.suggestedFollowUps.map((fq) => (
                          <button
                            key={fq}
                            type="button"
                            disabled={isLoading}
                            onClick={() => onSubmitQuery(fq)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800/80 rounded-lg transition-colors cursor-pointer text-left disabled:opacity-50"
                          >
                            <span>{fq}</span>
                            <ArrowRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.article>
              );
            })
          )}

          {/* Animated 3-Stage Pipeline Loading State */}
          {isLoading && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-teal-700 dark:text-teal-400">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                <span>Running Retrieval &amp; Grounded Synthesis</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {PIPELINE_STEPS.map((label, idx) => {
                  const isDone = idx < activePipelineStep;
                  const isCurrent = idx === activePipelineStep;
                  return (
                    <div
                      key={label}
                      className={`px-3 py-2 rounded-lg border transition-colors ${
                        isDone
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                          : isCurrent
                          ? 'bg-teal-50/80 dark:bg-teal-950/45 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-medium'
                          : 'bg-zinc-50 dark:bg-[#090d14] border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {idx + 1}. {label}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-red-900 dark:text-red-200">
                    Unable to Complete Request
                  </div>
                  <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              </div>
              {lastFailedQuery && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-medium text-red-900 dark:text-red-100 bg-white dark:bg-red-900/50 border border-red-300 dark:border-red-800 hover:bg-red-100 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>
      </div>

      {/* Bottom Query Composer */}
      <div className="px-6 py-4 bg-white dark:bg-[#0f1520] border-t border-zinc-200 dark:border-zinc-800">
        <form onSubmit={handleFormSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-zinc-50 dark:bg-[#090d14] border border-zinc-300 dark:border-zinc-700 focus-within:border-teal-600 focus-within:bg-white dark:focus-within:bg-[#0f1520] rounded-xl p-2 transition-colors shadow-xs">
            <textarea
              rows={2}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (inputValue.trim() && !isLoading) {
                    onSubmitQuery(inputValue.trim());
                  }
                }
              }}
              placeholder="Ask a question about your standards, uploaded code, or docs…"
              aria-label="Ask a grounded question"
              className="flex-1 bg-transparent px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              aria-label="Send query"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Ask</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
