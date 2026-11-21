import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  GitCompare,
  Info,
  Loader2,
  Play,
  ShieldAlert,
  Upload,
  Wand2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState, type ChangeEvent } from 'react';
import type { CodeFixResult, CodeReviewResult } from '../types/rag';
import { computeLineDiff } from '../utils/lineDiff';

const EXTERNAL_AI4_URL = 'https://sreenayak.github.io/IntelliFlow_AI/';

interface CodePreset {
  id: string;
  label: string;
  language: string;
  focus: string;
  code: string;
}

const CODE_PRESETS: CodePreset[] = [
  {
    id: 'api-route',
    label: 'API Route (Security + N+1)',
    language: 'TypeScript',
    focus: 'Full Review',
    code: `import { GoogleGenAI } from '@google/genai';
import express from 'express';

const router = express.Router();

router.post('/api/users/batch-audit', async (req, res) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const userIds: any[] = req.body.userIds;

  const results = [];
  for (const id of userIds) {
    const row = await db.query(\`SELECT * FROM users WHERE id = '\${id}'\`);
    results.push(row);
  }

  try {
    const reply = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: JSON.stringify(results),
    });
    res.json({ ok: true, summary: reply.text });
  } catch (err) {
    res.status(500).json({ message: 'Failed' });
  }
});`,
  },
  {
    id: 'react-hook',
    label: 'React Async Effect',
    language: 'TypeScript',
    focus: 'Architecture',
    code: `import { useEffect, useState } from 'react';

export function UserProfile({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch('/api/users/' + userId)
      .then((res) => res.json())
      .then((data) => setProfile(data));
  }, [userId]);

  if (!profile) {
    return <button onClick={() => window.alert('Still loading')}>Wait</button>;
  }

  return <div>{profile.name}</div>;
}`,
  },
  {
    id: 'db-worker',
    label: 'DB Pool & Timeout',
    language: 'TypeScript',
    focus: 'Performance',
    code: `import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 45,
});

export async function listTeamReports(teamIds: string[]) {
  const reports = [];
  for (const id of teamIds) {
    const res = await pool.query('SELECT * FROM reports WHERE team_id = $1', [id]);
    reports.push(...res.rows);
  }
  return reports;
}`,
  },
];

interface CodeReviewerViewProps {
  onIndexCodeAsDoc?: (title: string, content: string) => void;
}

export function CodeReviewerView({ onIndexCodeAsDoc }: CodeReviewerViewProps) {
  const [mode, setMode] = useState<'rag-review' | 'live-embed'>('rag-review');
  const [presetId, setPresetId] = useState<string>(CODE_PRESETS[0].id);
  const [language, setLanguage] = useState(CODE_PRESETS[0].language);
  const [focus, setFocus] = useState(CODE_PRESETS[0].focus);
  const [code, setCode] = useState(CODE_PRESETS[0].code);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [fixResult, setFixResult] = useState<CodeFixResult | null>(null);
  const [fixViewMode, setFixViewMode] = useState<'code' | 'diff'>('code');
  const [copiedFix, setCopiedFix] = useState(false);

  const diffLines = useMemo(() => {
    if (!fixResult) return [];
    return computeLineDiff(code, fixResult.fixedCode);
  }, [code, fixResult]);

  const handleSelectPreset = (id: string) => {
    const found = CODE_PRESETS.find((p) => p.id === id);
    if (!found) return;
    setPresetId(found.id);
    setLanguage(found.language);
    setFocus(found.focus);
    setCode(found.code);
    setFixResult(null);
    setResult(null);
    setError(null);
  };

  const handleUploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setCode(text);
      setFixResult(null);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'py') setLanguage('Python');
      else if (ext === 'js' || ext === 'jsx') setLanguage('JavaScript');
      else if (ext === 'sql') setLanguage('SQL');
      else if (ext === 'go') setLanguage('Go');
      else setLanguage('TypeScript');
      setError(null);
    } catch {
      setError('Unable to read the selected code file.');
    }
  };

  const handleRunReview = async () => {
    if (!code.trim() || isReviewing) return;
    setIsReviewing(true);
    setError(null);
    setFixResult(null);
    try {
      const res = await fetch('/api/code-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          language,
          focus,
          topK: 5,
          minSimilarity: 0.5,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Code review failed (${res.status}).`);
      }
      setResult(data as CodeReviewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code review request failed.');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleGenerateFix = async () => {
    if (!result || isFixing) return;
    setIsFixing(true);
    setError(null);
    try {
      const res = await fetch('/api/code-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          language,
          findings: result.findings,
          retrievedChunks: result.retrievedChunks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate code fix.');
      }
      setFixResult(data as CodeFixResult);
      setFixViewMode('diff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-fix request failed.');
    } finally {
      setIsFixing(false);
    }
  };

  const handleCopyFix = async () => {
    if (!fixResult) return;
    try {
      await navigator.clipboard.writeText(fixResult.fixedCode);
      setCopiedFix(true);
      setTimeout(() => setCopiedFix(false), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleExportReport = () => {
    if (!result) return;
    const findingsMd = result.findings
      .map(
        (f, i) =>
          `### ${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (${f.lineHint})\n${f.detail}\n\n**Fix:** ${f.recommendation}`
      )
      .join('\n\n');
    const md = `# StackLens — Code Audit Report\n\n**Language:** ${language} · **Focus:** ${focus} · **Status:** ${result.overallStatus}\n\n## Summary\n${result.summary}\n\n## Findings\n\n${findingsMd}\n`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stacklens-audit-${language.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full bg-[#f4f6f7] dark:bg-[#090d14] overflow-hidden transition-colors">
      {/* Workspace Sub-bar */}
      <div className="px-6 py-2.5 bg-white dark:bg-[#0f1520] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('rag-review')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'rag-review'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              RAG Code Audit
            </button>
            <button
              type="button"
              onClick={() => setMode('live-embed')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'live-embed'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              External AI-4 Reviewer
            </button>
          </div>

          <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline">
            {mode === 'rag-review'
              ? 'Audits code against your Knowledge Base standards with grounded auto-fixes & diff inspection'
              : 'Live embedded AI-4 streaming code reviewer'}
          </span>
        </div>

        <a
          href={EXTERNAL_AI4_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <span>Open External Reviewer</span>
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>

      {mode === 'live-embed' ? (
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#090d14]">
          <iframe
            title="External AI-4 Streaming Code Reviewer"
            src={EXTERNAL_AI4_URL}
            className="w-full flex-1 border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column: Dark IDE Code Editor Surface */}
            <section className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
                  <h1 className="text-sm font-semibold text-zinc-100">Source Code</h1>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    aria-label="Sample Preset"
                    value={presetId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-teal-500"
                  >
                    {CODE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="TypeScript">TypeScript</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="Python">Python</option>
                    <option value="SQL">SQL</option>
                    <option value="Go">Go</option>
                  </select>

                  <select
                    aria-label="Review Focus"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="Full Review">Full Review</option>
                    <option value="Security">Security</option>
                    <option value="Performance">Performance</option>
                    <option value="Architecture">Architecture</option>
                  </select>

                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept=".ts,.tsx,.js,.jsx,.py,.sql,.go,.txt,.md"
                      onChange={handleUploadFile}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              <div className="p-4">
                <textarea
                  rows={18}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste code to review against your Knowledge Base standards..."
                  aria-label="Code snippet for review"
                  className="w-full p-2 bg-transparent text-xs font-mono text-zinc-100 leading-relaxed focus:outline-none resize-y placeholder:text-zinc-500"
                />
              </div>

              <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(presetId)}
                    className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                  >
                    Reset Preset
                  </button>
                  {onIndexCodeAsDoc && code.trim() && (
                    <button
                      type="button"
                      onClick={() =>
                        onIndexCodeAsDoc(
                          `${language} Module Snippet`,
                          `# ${language} Code Reference\n\n\`\`\`${language.toLowerCase()}\n${code.trim()}\n\`\`\``
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                    >
                      <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Save to Knowledge Base</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRunReview}
                  disabled={isReviewing || !code.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isReviewing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{isReviewing ? 'Auditing Code…' : 'Review Code'}</span>
                </button>
              </div>
            </section>

            {/* Right Column: Review Findings & Auto-Fix + Line Diff */}
            <section className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-xl flex items-start gap-2.5 text-xs text-red-800 dark:text-red-200"
                >
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="font-semibold text-red-900 dark:text-red-100">
                      Code Review Failed
                    </div>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {isReviewing && (
                <div className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-2 text-xs font-medium text-teal-700 dark:text-teal-400">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Matching against engineering standards and auditing code…</span>
                  </div>
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4" />
                    <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded w-11/12" />
                    <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded w-2/3" />
                  </div>
                </div>
              )}

              {!isReviewing && !result && !error && (
                <div className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-2 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                    Grounded Code Audit Ready
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Choose a preset or paste your own code, then click <strong className="text-zinc-900 dark:text-zinc-200">Review Code</strong> to detect violations against your Knowledge Base and preview a line-by-line grounded diff fix.
                  </p>
                </div>
              )}

              {result && !isReviewing && (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800 text-xs flex-wrap">
                      <div className="flex items-center gap-2">
                        {result.overallStatus === 'pass' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              Pass · Compliant
                            </span>
                          </>
                        ) : result.overallStatus === 'critical_issues' ? (
                          <>
                            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" aria-hidden="true" />
                            <span className="font-semibold text-red-700 dark:text-red-400">
                              Critical Issues Found
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              Needs Changes
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {result.findings.length} findings · {(result.promptTrace.latencyMs / 1000).toFixed(1)}s
                        </span>
                        <button
                          type="button"
                          onClick={handleExportReport}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Export</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {result.summary}
                    </p>

                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateFix}
                        disabled={isFixing}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                      >
                        {isFixing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {isFixing ? 'Generating Grounded Fix…' : 'Generate Grounded Fix'}
                        </span>
                      </button>
                    </div>
                  </motion.div>

                  {fixResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm"
                    >
                      <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-2 text-xs flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-emerald-400">
                            Grounded Fix ({(fixResult.latencyMs / 1000).toFixed(1)}s)
                          </span>
                          <div className="flex items-center gap-1 p-0.5 bg-zinc-800 rounded-md">
                            <button
                              type="button"
                              onClick={() => setFixViewMode('diff')}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                                fixViewMode === 'diff'
                                  ? 'bg-zinc-950 text-white'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              <GitCompare className="w-3 h-3" aria-hidden="true" />
                              <span>Line Diff</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFixViewMode('code')}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                                fixViewMode === 'code'
                                  ? 'bg-zinc-950 text-white'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              Refactored Code
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyFix}
                            className="inline-flex items-center gap-1 px-2 py-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded cursor-pointer"
                          >
                            {copiedFix ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedFix ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCode(fixResult.fixedCode)}
                            className="px-2.5 py-1 font-medium text-white bg-teal-600 hover:bg-teal-500 rounded cursor-pointer"
                          >
                            Apply to Editor
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800 text-xs text-zinc-300">
                        {fixResult.changeSummary}
                      </div>

                      {fixViewMode === 'diff' ? (
                        <div className="max-h-96 overflow-auto font-mono text-[11px] leading-relaxed">
                          {diffLines.map((line, i) => (
                            <div
                              key={i}
                              className={`px-3 py-0.5 flex gap-3 whitespace-pre ${
                                line.type === 'added'
                                  ? 'bg-emerald-950/55 text-emerald-200'
                                  : line.type === 'removed'
                                  ? 'bg-red-950/55 text-red-200'
                                  : 'text-zinc-300'
                              }`}
                            >
                              <span className="w-8 shrink-0 text-right text-zinc-500 select-none tabular-nums">
                                {line.oldLine ?? ''}
                              </span>
                              <span className="w-8 shrink-0 text-right text-zinc-500 select-none tabular-nums">
                                {line.newLine ?? ''}
                              </span>
                              <span className="w-3 shrink-0 select-none font-bold">
                                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                              </span>
                              <span className="flex-1">{line.text || ' '}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <pre className="p-4 text-xs font-mono text-zinc-100 overflow-x-auto leading-relaxed">
                          {fixResult.fixedCode}
                        </pre>
                      )}
                    </motion.div>
                  )}

                  <div className="space-y-3">
                    {result.findings.map((finding, idx) => (
                      <motion.article
                        key={`${finding.title}-${idx}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.18,
                          delay: idx * 0.04,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold">
                            {finding.severity === 'critical' ? (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5 text-red-600 dark:text-red-400" aria-hidden="true" />
                                <span className="text-red-700 dark:text-red-400">Critical</span>
                              </>
                            ) : finding.severity === 'warning' ? (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                                <span className="text-amber-700 dark:text-amber-400">Warning</span>
                              </>
                            ) : (
                              <>
                                <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                                <span className="text-teal-700 dark:text-teal-400">Suggestion</span>
                              </>
                            )}
                            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                              ·
                            </span>
                            <span className="text-zinc-900 dark:text-zinc-100">{finding.title}</span>
                          </div>
                          <span className="font-mono text-zinc-500 dark:text-zinc-400 shrink-0">
                            {finding.lineHint}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          {finding.detail}
                        </p>

                        <div className="pt-1 text-xs text-zinc-800 dark:text-zinc-200">
                          <span className="font-semibold">Fix: </span>
                          {finding.recommendation}
                        </div>

                        {finding.citedChunkIds.length > 0 && (
                          <div className="pt-1 text-[11px] font-mono text-teal-700 dark:text-teal-400">
                            Referenced standards: {finding.citedChunkIds.map((c) => `[${c}]`).join(' ')}
                          </div>
                        )}
                      </motion.article>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                    <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Matched Knowledge Base Standards ({result.retrievedChunks.length})
                    </h3>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {result.retrievedChunks.map((rc) => (
                        <div key={rc.id} className="py-2 text-xs space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                              [{rc.citationLabel}] {rc.docCode}
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                              {Math.round(rc.similarity * 100)}% match
                            </span>
                          </div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {rc.docTitle} · {rc.sectionTitle}
                          </div>
                          <p className="text-zinc-600 dark:text-zinc-400 line-clamp-2">
                            {rc.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
