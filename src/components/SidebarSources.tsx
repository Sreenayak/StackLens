import { BookOpen, Moon, RefreshCw, Search, Sun, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DocumentChunkItem, IndexStatus, SourceDocument } from '../types/rag';

interface SidebarSourcesProps {
  documents: SourceDocument[];
  chunks: DocumentChunkItem[];
  status: IndexStatus | null;
  selectedDocId: string | null;
  isReindexing: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onSelectDocument: (docId: string) => void;
  onReindex: () => void;
  onDeleteDocument: (docId: string) => void;
}

export function SidebarSources({
  documents,
  chunks,
  status,
  selectedDocId,
  isReindexing,
  isDark,
  onToggleTheme,
  onSelectDocument,
  onReindex,
  onDeleteDocument,
}: SidebarSourcesProps) {
  const [filterText, setFilterText] = useState('');

  const chunkCountByDoc = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of chunks) {
      map.set(c.docId, (map.get(c.docId) ?? 0) + 1);
    }
    return map;
  }, [chunks]);

  const filteredDocs = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.docCode.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [documents, filterText]);

  return (
    <aside className="w-72 shrink-0 bg-white dark:bg-[#0f1520] border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full overflow-hidden transition-colors">
      <div className="px-4 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h2 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            Workspace Sources
          </h2>
          <button
            type="button"
            onClick={onReindex}
            disabled={isReindexing}
            title="Sync Gemini embeddings for all workspace sources"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded-md transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3 h-3 ${isReindexing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isReindexing ? 'Syncing' : 'Sync Index'}</span>
          </button>
        </div>

        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter documents..."
            aria-label="Filter source documents"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-[#090d14] border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/70">
        {filteredDocs.length === 0 ? (
          <div className="p-4 text-xs text-zinc-500 dark:text-zinc-400">
            No documents match "{filterText}".
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const count = chunkCountByDoc.get(doc.id) ?? 0;
            const isSelected = selectedDocId === doc.id;
            return (
              <div
                key={doc.id}
                className={`group flex items-start justify-between gap-2 px-4 py-3 transition-colors ${
                  isSelected
                    ? 'bg-teal-50/75 dark:bg-teal-950/35'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectDocument(doc.id)}
                  className="flex-1 text-left min-w-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600"
                >
                  <div className="flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-400 font-mono tabular-nums mb-0.5">
                    <span>{doc.docCode}</span>
                    <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">
                      ·
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 font-sans">
                      {doc.category}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">
                    {doc.title}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    <BookOpen className="w-3 h-3 text-zinc-400 shrink-0" aria-hidden="true" />
                    <span>{count} passages</span>
                    <span aria-hidden="true">·</span>
                    <span>{doc.updatedAt}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteDocument(doc.id)}
                  aria-label={`Delete ${doc.title}`}
                  className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer summary + Theme switcher */}
      <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#090d14]/70 text-xs text-zinc-600 dark:text-zinc-400 tabular-nums space-y-2">
        <div className="flex items-center justify-between">
          <span>Library</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-200">
            {status ? `${status.documentCount} sources · ${status.chunkCount} passages` : 'Loading…'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Search Index</span>
          <span className="text-zinc-800 dark:text-zinc-300">
            {status?.isIndexed ? 'Synced & Ready' : 'Auto-syncs on query'}
          </span>
        </div>
        <div className="pt-1 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <span>Appearance</span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-teal-500 dark:hover:border-teal-500 rounded-md transition-colors cursor-pointer"
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
