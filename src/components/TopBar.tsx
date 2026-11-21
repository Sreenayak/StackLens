import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { WorkspaceTab } from '../types/rag';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenAddDocument: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'assistant', label: 'Assistant' },
  { id: 'code-reviewer', label: 'Code Reviewer' },
  { id: 'documents', label: 'Knowledge Base' },
  { id: 'prompt-lab', label: 'Prompt Lab' },
];

export function TopBar({ activeTab, onSelectTab, onOpenAddDocument }: TopBarProps) {
  return (
    <header className="h-14 shrink-0 bg-white dark:bg-[#0f1520] border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between gap-8 transition-colors">
      {/* Zone 1: Single text element wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab('assistant')}
        className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
      >
        StackLens
      </button>

      {/* Zone 2: Clean single-line text navigation links with shared layout underline */}
      <nav aria-label="Primary" className="flex items-center gap-7 overflow-x-auto h-full">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative h-full inline-flex items-center text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
                isActive
                  ? 'text-zinc-950 dark:text-white'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <span>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="topbar-nav-underline"
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 dark:bg-teal-400"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onOpenAddDocument}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add Source</span>
        </button>
      </div>
    </header>
  );
}
