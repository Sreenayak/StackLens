import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface FormattedAnswerProps {
  text: string;
  onCitationClick?: (label: string) => void;
}

function renderInlineTokens(
  line: string,
  onCitationClick?: (label: string) => void
): ReactNode[] {
  const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\[C\d+\])/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-zinc-950 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 text-[12px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded border border-zinc-200 dark:border-zinc-700"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (/^\[C\d+\]$/.test(token)) {
      const label = token.slice(1, -1);
      return (
        <button
          key={idx}
          type="button"
          onClick={() => onCitationClick?.(label)}
          title={`View source passage ${label}`}
          className="inline-flex items-center mx-0.5 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 rounded transition-colors cursor-pointer align-baseline"
        >
          {token}
        </button>
      );
    }
    return <span key={idx}>{token}</span>;
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="my-2.5 rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
        <span>{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-zinc-300 hover:text-white cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-zinc-100 overflow-x-auto leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

export function FormattedAnswer({ text, onCitationClick }: FormattedAnswerProps) {
  const segments = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
      {segments.map((seg, segIdx) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const inner = seg.slice(3, -3);
          const firstNewline = inner.indexOf('\n');
          const lang = firstNewline >= 0 ? inner.slice(0, firstNewline).trim() : '';
          const codeBody = firstNewline >= 0 ? inner.slice(firstNewline + 1) : inner;
          return <CodeBlock key={segIdx} lang={lang} code={codeBody.trimEnd()} />;
        }

        const lines = seg.split('\n');
        const elements: ReactNode[] = [];
        let listBuffer: string[] = [];

        const flushList = (keyPrefix: string) => {
          if (listBuffer.length === 0) return;
          elements.push(
            <ul key={`${keyPrefix}-list`} className="list-disc pl-5 space-y-1">
              {listBuffer.map((item, i) => (
                <li key={i}>{renderInlineTokens(item, onCitationClick)}</li>
              ))}
            </ul>
          );
          listBuffer = [];
        };

        lines.forEach((rawLine, lineIdx) => {
          const trimmed = rawLine.trim();
          if (!trimmed) {
            flushList(`${segIdx}-${lineIdx}`);
            return;
          }
          if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
            flushList(`${segIdx}-${lineIdx}`);
            const headingText = trimmed.replace(/^#{2,3}\s+/, '');
            elements.push(
              <h4
                key={`${segIdx}-${lineIdx}`}
                className="text-sm font-bold text-zinc-950 dark:text-white pt-1"
              >
                {renderInlineTokens(headingText, onCitationClick)}
              </h4>
            );
            return;
          }
          if (/^[-*]\s+/.test(trimmed)) {
            listBuffer.push(trimmed.replace(/^[-*]\s+/, ''));
            return;
          }
          if (/^\d+\.\s+/.test(trimmed)) {
            listBuffer.push(trimmed.replace(/^\d+\.\s+/, ''));
            return;
          }
          flushList(`${segIdx}-${lineIdx}`);
          elements.push(
            <p key={`${segIdx}-${lineIdx}`}>
              {renderInlineTokens(trimmed, onCitationClick)}
            </p>
          );
        });

        flushList(`${segIdx}-end`);
        return <div key={segIdx} className="space-y-2">{elements}</div>;
      })}
    </div>
  );
}
