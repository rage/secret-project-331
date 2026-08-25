import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"
import {
  zChatbotConversationMessageMessage,
  zChatbotConversationMessageReasoning,
  zChatbotConversationMessageToolCall,
  zChatbotConversationMessageToolOutput,
} from "@/generated/course-material-api/zod.generated"

import { CLIENT_TOOL_REGISTRY } from "./clientToolRegistry"

/**
 * What a conversation message is, decided by zod once per message so a caller that re-runs on
 * every streamed token — as `ChatbotChatBody` does — only classifies the messages that changed
 * instead of re-parsing the whole conversation.
 */
export type MessageClassification =
  | { kind: "clientToolCall"; toolCallId: string; toolName: string; call: unknown }
  | { kind: "toolOutput"; toolCallId: string; clientAnswer: unknown }
  | { kind: "userText"; text: string; isComplete: boolean }
  | { kind: "assistantText"; text: string; isComplete: boolean }
  | { kind: "toolCall" }
  | { kind: "reasoning" }
  | { kind: "other" }

export const classifyMessage = (message: ChatbotConversationMessage): MessageClassification => {
  const toolCall = zChatbotConversationMessageToolCall.safeParse(message.message)
  if (toolCall.success) {
    const entry = CLIENT_TOOL_REGISTRY[toolCall.data.tool_name]
    const call = entry
      ? entry.parseCall(toolCall.data.tool_call_id, toolCall.data.tool_arguments)
      : null
    if (call !== null) {
      return {
        // oxlint-disable-next-line i18next/no-literal-string -- discriminant tag, never rendered
        kind: "clientToolCall",
        toolCallId: toolCall.data.tool_call_id,
        toolName: toolCall.data.tool_name,
        call,
      }
    }
    // oxlint-disable-next-line i18next/no-literal-string -- discriminant tag, never rendered
    return { kind: "toolCall" }
  }
  const text = zChatbotConversationMessageMessage.safeParse(message.message)
  if (
    text.success &&
    (text.data.message_role === "user" || text.data.message_role === "assistant")
  ) {
    return {
      // oxlint-disable-next-line i18next/no-literal-string -- discriminant tags, never rendered
      kind: text.data.message_role === "user" ? "userText" : "assistantText",
      text: text.data.text ?? "",
      isComplete: text.data.message_is_complete,
    }
  }
  const output = zChatbotConversationMessageToolOutput.safeParse(message.message)
  if (output.success) {
    return {
      // oxlint-disable-next-line i18next/no-literal-string -- discriminant tag, never rendered
      kind: "toolOutput",
      toolCallId: output.data.tool_call_id,
      clientAnswer: output.data.client_answer ?? null,
    }
  }
  if (zChatbotConversationMessageReasoning.safeParse(message.message).success) {
    // oxlint-disable-next-line i18next/no-literal-string -- discriminant tag, never rendered
    return { kind: "reasoning" }
  }
  // oxlint-disable-next-line i18next/no-literal-string -- discriminant tag, never rendered
  return { kind: "other" }
}

/**
 * The answer stored with each closed call's tool output, by the call it answers. Null for a call
 * that was aborted rather than answered, and for one answered before answers were stored; the key
 * being present is what marks the call closed.
 */
export const clientAnswerByToolCallIdFromClassified = (
  classified: MessageClassification[],
): Map<string, unknown> => {
  const answers = new Map<string, unknown>()
  for (const c of classified) {
    if (c.kind === "toolOutput") {
      answers.set(c.toolCallId, c.clientAnswer)
    }
  }
  return answers
}

/** A client tool call still waiting for the learner, with the call the model made. */
export interface OpenClientToolCall {
  toolCallId: string
  toolName: string
  call: unknown
}

/**
 * The client tool calls in a conversation that are still waiting for the learner, in conversation
 * order.
 *
 * A client tool call is closed by a `ToolOutput` message carrying its `tool_call_id`, which is
 * also how the backend records aborting one. An abort is only visible once the conversation is
 * fetched again, so a message the learner sent afterwards closes the calls before it too: sending
 * one aborts every call the turn was waiting on.
 *
 * `classified` must be in conversation order, and may mix fetched messages with ones a running
 * stream has added.
 */
export const openClientToolCallsFromClassified = (
  classified: MessageClassification[],
): OpenClientToolCall[] => {
  const closed = new Set(classified.flatMap((c) => (c.kind === "toolOutput" ? [c.toolCallId] : [])))

  let open: OpenClientToolCall[] = []
  for (const c of classified) {
    if (c.kind === "clientToolCall") {
      if (!closed.has(c.toolCallId)) {
        open.push(c)
      }
      continue
    }
    if (c.kind === "userText") {
      open = []
    }
  }
  return open
}

export const openClientToolCalls = (messages: ChatbotConversationMessage[]): OpenClientToolCall[] =>
  openClientToolCallsFromClassified(messages.map((message) => classifyMessage(message)))

/** Whether any client tool call in the conversation is still waiting for the learner. */
export const hasOpenClientToolCall = (messages: ChatbotConversationMessage[]): boolean =>
  openClientToolCalls(messages).length > 0
