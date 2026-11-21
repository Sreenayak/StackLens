import { CheckCircle2, Code2, FileSearch, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { ChatMessage } from '../types/rag';

interface InspectorPanelProps {
  activeMessage: ChatMessage | null;
  highlightedCitation: string | null;
}

export function InspectorPanel({ activeMessage, highlightedCitation }: InspectorPanelProps) {
  const [inspectorTab, setInspectorTab] = useState<'chunks' | 'prompt'>('chunks');
  const rag = activeMessage?.ragResult;

  return (
    <aside className="w-96 shrink-0 bg-white dark:bg-[#0f1520] border-l border-zinc-200 dark:border-zinc-800 flex flex-col h-full overflow-hidden transition-colors">
      <div className="px-4 pt-3.5 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h2 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            Source Evidence &amp; Prompt
          </h2>
          {rag && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {(rag.promptTrace.latencyMs / 1000).toFixed(1)}s response
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
          <button
            type="button"
            onClick={() => setInspectorTab('chunks')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              inspectorTab === 'chunks'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <FileSearch className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Matched Sources</span>
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab('prompt')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              inspectorTab === 'prompt'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Prompt Details</span>
          </button>
        </div>
      </div>

      {!rag ? (
        <div className="flex-1 p-6 flex flex-col justify-center text-center">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
            Source Evidence Appears Here
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            When you ask a question, this panel shows the exact document passages retrieved, their cosine similarity strength, and the engineered prompt used.
          </p>
        </div>
      ) : inspectorTab === 'chunks' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rag.promptTrace.standaloneQuery !== activeMessage.content && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                Search query used:{' '}
              </span>
              <span>{rag.promptTrace.standaloneQuery}</span>
            </div>
          )}

          {rag.retrievedChunks.map((chunk, idx) => {
            const isCited = rag.citedChunkIds.includes(chunk.citationLabel);
            const isHighlighted = highlightedCitation === chunk.citationLabel;
            const matchPct = Math.max(0, Math.min(100, Math.round(chunk.similarity * 100)));

            return (
              <motion.div
                key={chunk.id}
                id={`trace-chunk-${chunk.citationLabel}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className={`p-3.5 rounded-xl border transition-colors ${
                  isHighlighted
                    ? 'border-teal-600 dark:border-teal-500 bg-teal-50/50 dark:bg-teal-950/35'
                    : isCited
                    ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#090d14]'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400">
                      [{chunk.citationLabel}]
                    </span>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                      {chunk.docCode}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-xs tabular-nums">
                    {chunk.passedThreshold ? (
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <ShieldAlert
                        className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={
                        chunk.passedThreshold
                          ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                          : 'text-amber-700 dark:text-amber-400 font-semibold'
                      }
                    >
                      {matchPct}% match
                    </span>
                  </div>
                </div>

                {/* Animated match strength bar (compositor-only scaleX) */}
                <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2.5">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: matchPct / 100 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: 'left' }}
                    className={`h-full w-full rounded-full ${
                      chunk.passedThreshold ? 'bg-teal-600 dark:bg-teal-400' : 'bg-amber-500'
                    }`}
                  />
                </div>

                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                  {chunk.docTitle}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                  {chunk.sectionTitle}
                  {isCited ? ' · Cited in answer' : ''}
                </div>

                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {chunk.text}
                </p>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span>Model</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100">
                {rag.promptTrace.model}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Embedding Engine</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100">
                {rag.promptTrace.embeddingModel}
              </span>
            </div>
            <div className="flex items-center justify-between tabular-nums">
              <span>Few-Shot Examples</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {rag.promptTrace.fewShotExamplesCount} active
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
              System Instruction
            </h3>
            <pre className="p-3 bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-800 rounded-lg text-[11px] leading-relaxed font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap overflow-x-auto">
              {rag.promptTrace.systemInstruction}
            </pre>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
              Assembled Prompt
            </h3>
            <pre className="p-3 bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-800 rounded-lg text-[11px] leading-relaxed font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap overflow-x-auto">
              {rag.promptTrace.assembledUserPrompt}
            </pre>
          </div>
        </div>
      )}
    </aside>
  );
}
