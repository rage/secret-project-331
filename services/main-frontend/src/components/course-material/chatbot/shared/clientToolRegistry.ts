import type { ClientToolAnswer } from "@/generated/course-material-api/types.generated"

import MultipleChoiceQuestionBubble from "./MultipleChoiceQuestionBubble"
import {
  ASK_MULTIPLE_CHOICE_QUESTION_TOOL,
  parseMultipleChoiceQuestion,
} from "./multipleChoiceQuestions"

/** What a call closed with, if it has: absent while `isOpen`. */
export type ClosedClientToolAnswer = { value: unknown } | undefined

export interface ClientToolBubbleProps<TCall> {
  toolCallId: string
  call: TCall
  /** Whether the call is still waiting for the learner. */
  isOpen: boolean
  /** Whether a turn is streaming right now; no answer can be sent while true. */
  isTurnInFlight: boolean
  closedAnswer: ClosedClientToolAnswer
  onAnswer: (toolCallId: string, answer: ClientToolAnswer) => void
}

export interface ClientToolRegistryEntry<TCall> {
  /**
   * Parses and validates a call's raw arguments into `TCall`, or null if this tool cannot make
   * sense of them. A null call renders as an anonymous tool status line instead of `Bubble`.
   */
  parseCall: (toolCallId: string, toolArguments: string) => TCall | null
  Bubble: React.FC<ClientToolBubbleProps<TCall>>
}

/**
 * Client tools the frontend knows how to recognize, validate and render, keyed by the name the
 * model calls them with. Each entry owns everything specific to its own answer shape; code that
 * dispatches through this registry never needs to know a tool's argument or answer shape.
 */
// oxlint-disable-next-line no-explicit-any -- type-erased map keyed by tool name; each entry's own TCall is checked at the object literal below.
export const CLIENT_TOOL_REGISTRY: Record<string, ClientToolRegistryEntry<any>> = {
  [ASK_MULTIPLE_CHOICE_QUESTION_TOOL]: {
    parseCall: parseMultipleChoiceQuestion,
    Bubble: MultipleChoiceQuestionBubble,
  },
}
