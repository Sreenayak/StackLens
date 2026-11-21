import { AlertTriangle, Globe, Loader2, Upload, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

interface AddDocumentModalProps {
  isOpen: boolean;
  initialTitle?: string;
  initialCategory?: string;
  initialContent?: string;
  onClose: () => void;
  onDocumentAdded: () => Promise<void>;
}

export function AddDocumentModal({
  isOpen,
  initialTitle = '',
  initialCategory = 'Code & Docs',
  initialContent = '',
  onClose,
  onDocumentAdded,
}: AddDocumentModalProps) {
  const [sourceMode, setSourceMode] = useState<'text' | 'url'>('text');
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [content, setContent] = useState(initialContent);
  const [urlInput, setUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setCategory(initialCategory);
      setContent(initialContent);
      setUrlInput('');
      setSourceMode('text');
      setError(null);
    }
  }, [isOpen, initialTitle, initialCategory, initialContent]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!title.trim()) {
        setTitle(file.name);
      }
      setContent(text);
      setError(null);
    } catch {
      setError('Could not read the selected file.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (sourceMode === 'url') {
      if (!urlInput.trim()) {
        setError('Please enter a valid URL to fetch and index.');
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/documents/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urlInput.trim(),
            title: title.trim() || undefined,
            category: category.trim() || 'Web Import',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch and index URL.');
        }
        await onDocumentAdded();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import URL.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!title.trim() || !content.trim()) {
      setError('Please enter both a document title and content.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim() || 'Code & Docs',
          content: content.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to index document.');
      }
      setTitle('');
      setContent('');
      await onDocumentAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to embed document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-doc-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 backdrop-blur-[2px] p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl bg-white dark:bg-[#0f1520] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 id="add-doc-title" className="text-base font-bold text-zinc-900 dark:text-white">
            Add Source to Vector Index
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Source Type Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
            <button
              type="button"
              onClick={() => setSourceMode('text')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                sourceMode === 'text'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Paste Text or Upload File
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('url')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                sourceMode === 'url'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Import from URL</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-md flex items-start gap-2 text-xs text-red-800 dark:text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {sourceMode === 'url' && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Public Documentation or Raw GitHub URL
              </span>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://raw.githubusercontent.com/user/repo/main/README.md"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#090d14] border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-teal-600"
              />
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="sm:col-span-2 block space-y-1">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Document / File Title {sourceMode === 'url' ? '(Optional)' : ''}
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., AuthMiddleware.ts or API Guidelines"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#090d14] border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-teal-600"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Category
              </span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Code & Docs"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#090d14] border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-teal-600"
              />
            </label>
          </div>

          {sourceMode === 'text' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="doc-content-input"
                  className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Content (Code, Markdown, or Plain Text)
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Upload code / .md / .txt</span>
                  <input
                    type="file"
                    accept=".ts,.tsx,.js,.jsx,.py,.sql,.go,.json,.txt,.md,text/plain,text/markdown"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>
              <textarea
                id="doc-content-input"
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste source code, PR guidelines, or markdown sections (## Section Heading)..."
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-[#090d14] border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-teal-600"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              <span>
                {isSubmitting
                  ? sourceMode === 'url'
                    ? 'Fetching & Embedding…'
                    : 'Chunking & Embedding…'
                  : sourceMode === 'url'
                  ? 'Fetch & Index URL'
                  : 'Chunk & Embed Source'}
              </span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
