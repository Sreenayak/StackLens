import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { AddDocumentModal } from './components/AddDocumentModal';
import { ChatWorkspace } from './components/ChatWorkspace';
import { CodeReviewerView } from './components/CodeReviewerView';
import { InspectorPanel } from './components/InspectorPanel';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { PromptLabView } from './components/PromptLabView';
import { SidebarSources } from './components/SidebarSources';
import { TopBar } from './components/TopBar';
import type {
  ChatMessage,
  DocumentChunkItem,
  IndexStatus,
  RagQueryResult,
  SourceDocument,
  WorkspaceTab,
} from './types/rag';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('assistant');
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [chunks, setChunks] = useState<DocumentChunkItem[]>([]);
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);

  const [topK, setTopK] = useState(4);
  const [minSimilarity, setMinSimilarity] = useState(0.62);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [highlightedCitation, setHighlightedCitation] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('stacklens-theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<{
    title: string;
    category: string;
    content: string;
  }>({
    title: '',
    category: 'Code & Docs',
    content: '',
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('stacklens-theme', isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage error
    }
  }, [isDark]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Unable to load knowledge base documents.');
      const data = (await res.json()) as {
        documents: SourceDocument[];
        chunks: DocumentChunkItem[];
        status: IndexStatus;
      };
      setDocuments(data.documents);
      setChunks(data.chunks);
      setStatus(data.status);
      setSelectedDocId((prev) => prev ?? data.documents[0]?.id ?? null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load documents.'
      );
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const handleReindex = async () => {
    setIsReindexing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to build vector embeddings.');
      }
      await fetchDocuments();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Indexing failed.'
      );
    } finally {
      setIsReindexing(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete document.');
      }
      if (selectedDocId === docId) {
        setSelectedDocId(null);
      }
      await fetchDocuments();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Delete operation failed.'
      );
    }
  };

  const handleRestoreDefaults = async () => {
    setErrorMessage(null);
    try {
      const res = await fetch('/api/documents/restore', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore default documents.');
      }
      await fetchDocuments();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Restore operation failed.'
      );
    }
  };

  const handleSubmitQuery = async (queryText: string) => {
    const clean = queryText.trim();
    if (!clean || isQuerying) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: clean,
      timestamp: new Date().toISOString(),
    };

    const historyPayload = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsQuerying(true);
    setErrorMessage(null);
    setLastFailedQuery(null);
    setHighlightedCitation(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clean,
          history: historyPayload,
          topK,
          minSimilarity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `API request failed (${res.status}).`);
      }

      const ragResult = data as RagQueryResult;
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: ragResult.answer,
        timestamp: new Date().toISOString(),
        ragResult,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setSelectedMessageId(assistantMsg.id);
      void fetchDocuments();
    } catch (err) {
      setLastFailedQuery(clean);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while querying the RAG pipeline.'
      );
    } finally {
      setIsQuerying(false);
    }
  };

  const handleRetry = () => {
    if (!lastFailedQuery) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'user' && last.content === lastFailedQuery) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    void handleSubmitQuery(lastFailedQuery);
  };

  const handleCitationClick = (msgId: string, citationLabel: string) => {
    setSelectedMessageId(msgId);
    setIsInspectorOpen(true);
    setHighlightedCitation(citationLabel);
    setTimeout(() => {
      const el = document.getElementById(`trace-chunk-${citationLabel}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handleSelectSidebarDoc = (docId: string) => {
    setSelectedDocId(docId);
    setActiveTab('documents');
  };

  const handleAskFromKnowledgeBase = (question: string) => {
    setActiveTab('assistant');
    void handleSubmitQuery(question);
  };

  const openBlankAddModal = () => {
    setModalPrefill({ title: '', category: 'Code & Docs', content: '' });
    setIsAddModalOpen(true);
  };

  const openPrefilledAddModal = (title: string, content: string) => {
    setModalPrefill({ title, category: 'Source Code', content });
    setIsAddModalOpen(true);
  };

  const activeInspectorMessage =
    messages.find((m) => m.id === selectedMessageId && m.role === 'assistant') ??
    [...messages].reverse().find((m) => m.role === 'assistant') ??
    null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#f4f6f7] dark:bg-[#090d14] text-zinc-900 dark:text-zinc-100 transition-colors">
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenAddDocument={openBlankAddModal}
        />

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {activeTab !== 'code-reviewer' && (
            <div className="hidden md:flex">
              <SidebarSources
                documents={documents}
                chunks={chunks}
                status={status}
                selectedDocId={selectedDocId}
                isReindexing={isReindexing}
                isDark={isDark}
                onToggleTheme={() => setIsDark((d) => !d)}
                onSelectDocument={handleSelectSidebarDoc}
                onReindex={handleReindex}
                onDeleteDocument={handleDeleteDocument}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'assistant' && (
              <motion.div
                key="assistant"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="flex-1 flex min-w-0 h-full overflow-hidden"
              >
                <ChatWorkspace
                  messages={messages}
                  inputValue={inputValue}
                  isLoading={isQuerying}
                  errorMessage={errorMessage}
                  lastFailedQuery={lastFailedQuery}
                  topK={topK}
                  minSimilarity={minSimilarity}
                  selectedMessageId={activeInspectorMessage?.id ?? null}
                  isInspectorOpen={isInspectorOpen}
                  isDark={isDark}
                  onToggleTheme={() => setIsDark((d) => !d)}
                  onToggleInspector={() => setIsInspectorOpen((v) => !v)}
                  onOpenCodeReviewer={() => setActiveTab('code-reviewer')}
                  onOpenAddDocument={openBlankAddModal}
                  onInputChange={setInputValue}
                  onSubmitQuery={handleSubmitQuery}
                  onRetry={handleRetry}
                  onClearChat={() => {
                    setMessages([]);
                    setSelectedMessageId(null);
                    setErrorMessage(null);
                    setLastFailedQuery(null);
                  }}
                  onChangeTopK={setTopK}
                  onChangeMinSimilarity={setMinSimilarity}
                  onSelectMessage={(id) => {
                    setSelectedMessageId(id);
                    setIsInspectorOpen(true);
                    setHighlightedCitation(null);
                  }}
                  onCitationClick={handleCitationClick}
                />

                {isInspectorOpen && (
                  <div className="hidden lg:flex">
                    <InspectorPanel
                      activeMessage={activeInspectorMessage}
                      highlightedCitation={highlightedCitation}
                    />
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'code-reviewer' && (
              <motion.div
                key="code-reviewer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="flex-1 flex min-w-0 h-full overflow-hidden"
              >
                <CodeReviewerView onIndexCodeAsDoc={openPrefilledAddModal} />
              </motion.div>
            )}

            {activeTab === 'documents' && (
              <motion.div
                key="documents"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="flex-1 flex min-w-0 h-full overflow-hidden"
              >
                <KnowledgeBaseView
                  documents={documents}
                  chunks={chunks}
                  selectedDocId={selectedDocId}
                  onSelectDoc={setSelectedDocId}
                  onOpenAddDocument={openBlankAddModal}
                  onDeleteDocument={handleDeleteDocument}
                  onRestoreDefaults={handleRestoreDefaults}
                  onAskQuestion={handleAskFromKnowledgeBase}
                />
              </motion.div>
            )}

            {activeTab === 'prompt-lab' && (
              <motion.div
                key="prompt-lab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="flex-1 flex min-w-0 h-full overflow-hidden"
              >
                <PromptLabView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AddDocumentModal
          isOpen={isAddModalOpen}
          initialTitle={modalPrefill.title}
          initialCategory={modalPrefill.category}
          initialContent={modalPrefill.content}
          onClose={() => setIsAddModalOpen(false)}
          onDocumentAdded={fetchDocuments}
        />
      </div>
    </MotionConfig>
  );
}
