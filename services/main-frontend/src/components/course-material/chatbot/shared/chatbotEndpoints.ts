import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"

import type {
  ChatbotConversation,
  ChatbotConversationInfo,
  ChatbotPageContext,
  ClientToolAnswer,
  ClientToolName,
} from "@/generated/course-material-api/types.generated"

/** One turn's request, before a backend maps it onto its own endpoint and body. */
export type ChatbotTurnRequest =
  | { kind: "message"; message: string; pageContext: ChatbotPageContext | undefined }
  | {
      kind: "toolResponse"
      toolCallId: string
      toolName: ClientToolName
      answer: ClientToolAnswer
    }

/** What a backend's new-conversation mutation reports back to the chat state on success. */
export interface NewConversationCallbacks {
  resetComposerMessage: () => void
  setError: (error: Error | null) => void
  setConvId: (conversationId: string | null) => void
}

/**
 * The backend one mounted chatbot talks to: the course material chatbot, or another that answers
 * with the same conversation types and response stream.
 *
 * The `use*` members are hooks, so a mounted chatbot must keep getting an adapter for the same
 * backend for as long as it is mounted.
 */
export interface ChatbotEndpoints {
  /** The conversation to resume until one is picked; `data` is null when there is none. */
  useCurrentConversationId: () => Pick<UseQueryResult<string | null>, "isLoading" | "data">
  /** The conversation, or with a null id, what to show before one exists. */
  useConversationInfo: (
    conversationId: string | null | undefined,
  ) => UseQueryResult<ChatbotConversationInfo, Error>
  useNewConversationMutation: (
    callbacks: NewConversationCallbacks,
  ) => UseMutationResult<ChatbotConversation, unknown, void, unknown>
  /** Null for a backend whose conversations have no titles. */
  useUpdateConversationTitleMutation: (
    conversationId: string | null | undefined,
  ) => UseMutationResult<unknown, unknown, string | null | undefined, unknown> | null
  /** Sends one turn and resolves to its NDJSON response stream. */
  postTurn: (
    request: ChatbotTurnRequest,
    conversationId: string,
    signal: AbortSignal,
  ) => Promise<ReadableStream<Uint8Array>>
}
