import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { PromptConfigResponse } from '../types/rag';

export function PromptLabView() {
  const [config, setConfig] = useState<PromptConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/prompt-config')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load prompt configuration');
        return res.json() as Promise<PromptConfigResponse>;
      })
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Load error');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex-1 overflow-y-auto bg-[#f4f6f7] dark:bg-[#090d14] p-6 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            Prompt Engineering &amp; Grounding Architecture
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Inspection of the system instructions, few-shot grounding and abstention examples, and enforced JSON response schema used across StackLens.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {config && (
          <>
            {/* Pipeline Summary Row */}
            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <div className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Embedding Model</div>
                <div className="text-sm font-mono font-semibold text-teal-700 dark:text-teal-400 mt-1">
                  {config.status.embeddingModel}
                </div>
              </div>
              <div className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Generation Model</div>
                <div className="text-sm font-mono font-semibold text-zinc-900 dark:text-white mt-1">
                  {config.status.generationModel}
                </div>
              </div>
              <div className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Few-Shot Calibration</div>
                <div className="text-sm font-mono font-semibold text-zinc-900 dark:text-white mt-1 tabular-nums">
                  {config.fewShotExamples.length} examples (grounding + abstention)
                </div>
              </div>
            </motion.section>

            {/* System Instruction */}
            <section className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-2.5">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                1. Grounded Q&amp;A System Instruction
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Enforces strict passage-only grounding, inline bracketed citations, and explicit refusal when retrieved chunks lack verification.
              </p>
              <pre className="p-4 bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {config.systemInstruction}
              </pre>
            </section>

            {config.codeReviewSystemInstruction && (
              <section className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-2.5">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  2. RAG Code Audit System Instruction
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Cross-checks submitted code against retrieved Knowledge Base standards and emits structured findings with inline citations.
                </p>
                <pre className="p-4 bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {config.codeReviewSystemInstruction}
                </pre>
              </section>
            )}

            {/* Few-Shot Examples */}
            <section className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  3. Few-Shot Prompt Examples
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Demonstrates single-source precision, multi-document synthesis, and graceful abstention on out-of-scope or unindexed rule queries.
                </p>
              </div>

              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                {config.fewShotExamples.map((ex, i) => (
                  <div key={ex.label} className="p-4 space-y-2.5">
                    <div className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                      Example {i + 1}: {ex.label}
                    </div>
                    <div className="text-xs text-zinc-900 dark:text-zinc-100">
                      <span className="font-semibold">Query: </span>
                      {ex.userQuery}
                    </div>
                    <pre className="p-3 bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-800 rounded text-[11px] font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                      {ex.retrievedContextSnippet}
                    </pre>
                    <pre className="p-3 bg-zinc-900 text-zinc-100 rounded text-[11px] font-mono whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(ex.expectedJson, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </section>

            {/* Enforced JSON Output Schema */}
            <section className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                4. Enforced Structured Output Schema
              </h2>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-[#090d14] border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Field</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {config.schemaFields.map((f) => (
                      <tr key={f.name}>
                        <td className="px-4 py-2.5 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          {f.name}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-teal-700 dark:text-teal-400">
                          {f.type}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                          {f.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
