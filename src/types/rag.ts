export interface SourceDocument {
  id: string;
  title: string;
  category: string;
  docCode: string;
  updatedAt: string;
  author: string;
  isDefault: boolean;
  content: string;
}

export interface DocumentChunkItem {
  id: string;
  docId: string;
  docTitle: string;
  docCode: string;
  category: string;
  sectionTitle: string;
  chunkIndex: number;
  totalChunksInDoc: number;
  charCount: number;
  text: string;
  indexed: boolean;
  embeddingDims: number;
}

export interface IndexStatus {
  documentCount: number;
  chunkCount: number;
  isIndexed: boolean;
  embeddingModel: string;
  generationModel: string;
  embeddingDims: number;
  lastIndexedAt: string | null;
}

export interface RetrievedChunk {
  id: string;
  citationLabel: string;
  docId: string;
  docTitle: string;
  docCode: string;
  category: string;
  sectionTitle: string;
  chunkIndex: number;
  totalChunksInDoc: number;
  text: string;
  similarity: number;
  passedThreshold: boolean;
}

export interface PromptTrace {
  model: string;
  embeddingModel: string;
  standaloneQuery: string;
  topK: number;
  minSimilarity: number;
  systemInstruction: string;
  fewShotExamplesCount: number;
  assembledUserPrompt: string;
  latencyMs: number;
}

export interface RagQueryResult {
  answer: string;
  grounded: boolean;
  confidence: 'high' | 'medium' | 'insufficient';
  citedChunkIds: string[];
  abstentionReason: string;
  suggestedFollowUps: string[];
  retrievedChunks: RetrievedChunk[];
  promptTrace: PromptTrace;
}

export interface CodeReviewFinding {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  lineHint: string;
  detail: string;
  recommendation: string;
  citedChunkIds: string[];
}

export interface CodeReviewResult {
  overallStatus: 'pass' | 'needs_changes' | 'critical_issues';
  summary: string;
  findings: CodeReviewFinding[];
  citedChunkIds: string[];
  retrievedChunks: RetrievedChunk[];
  promptTrace: PromptTrace;
}

export interface CodeFixResult {
  fixedCode: string;
  changeSummary: string;
  latencyMs: number;
}

export interface DocumentBriefResult {
  docId: string;
  summaryBullets: string[];
  suggestedQuestions: string[];
  latencyMs: number;
}

export interface SemanticSearchResult {
  query: string;
  results: RetrievedChunk[];
  latencyMs: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  ragResult?: RagQueryResult;
  error?: string;
}

export interface FewShotExample {
  label: string;
  userQuery: string;
  retrievedContextSnippet: string;
  expectedJson: {
    answer: string;
    grounded: boolean;
    confidence: string;
    citedChunkIds: string[];
    abstentionReason: string;
  };
}

export interface PromptConfigResponse {
  systemInstruction: string;
  codeReviewSystemInstruction?: string;
  fewShotExamples: FewShotExample[];
  schemaFields: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  status: IndexStatus;
}

export type WorkspaceTab = 'assistant' | 'code-reviewer' | 'documents' | 'prompt-lab';
