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
