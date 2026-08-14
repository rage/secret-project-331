import { z } from "zod"

import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"
import {
  zChatbotConversationMessageMessage,
  zChatbotConversationMessageToolCall,
  zChatbotConversationMessageToolOutput,
} from "@/generated/course-material-api/zod.generated"

/**
 * The client tool this UI answers.
 *
 * Equal to `AskMultipleChoiceQuestionTool::NAME` in
 * `services/headless-lms/chatbot/src/chatbot_tools/client_tools/ask_multiple_choice_question.rs`.
 * If the two drift apart the call renders as an anonymous tool status line and the turn stays
 * suspended until the learner writes something else.
 */
export const ASK_MULTIPLE_CHOICE_QUESTION_TOOL = "ask_multiple_choice_question"

/**
 * The bounds `AskMultipleChoiceQuestionTool::parse_arguments` enforces. Mirrored because a question
 * this accepts and the backend rejects renders as a button whose answer comes back an error.
 */
const MIN_CHOICES = 2
const MAX_CHOICES = 6

/** The arguments the model called the tool with, before the checks `questionOf` makes on them. */
const rawArguments = z.object({
  question: z.string(),
  choices: z.array(z.string()),
})

export interface MultipleChoiceQuestion {
  /** Names the call to the tool-response endpoint. */
  toolCallId: string
  question: string
  /**
   * Answered by position in this list. The backend resolves the position back to the text the
   * model wrote, so these strings are for the learner to read and never travel back.
   */
  choices: string[]
}

/**
 * The clarifying question a conversation message asks, or null if it asks none.
 *
 * Arguments are only validated when an answer for them arrives, so a question the learner could
 * not answer can reach us. Returning null for those keeps them out of the conversation flow as an
 * open question; the learner can still write instead, which aborts the call.
 */
export const questionOf = (message: ChatbotConversationMessage): MultipleChoiceQuestion | null => {
  const toolCall = zChatbotConversationMessageToolCall.safeParse(message.message)
  if (!toolCall.success || toolCall.data.tool_name !== ASK_MULTIPLE_CHOICE_QUESTION_TOOL) {
    return null
  }
  let parsedArguments: unknown
  try {
    parsedArguments = JSON.parse(toolCall.data.tool_arguments)
  } catch {
    return null
  }
  const args = rawArguments.safeParse(parsedArguments)
  if (!args.success) {
    return null
  }
  const question = args.data.question.trim()
  const choices = args.data.choices.map((choice) => choice.trim())
  // A blank or repeated choice is one the learner cannot tell the meaning of, and the backend
  // refuses to resolve an answer to it, so the whole question is unanswerable rather than partly
  // usable.
  if (
    question.length === 0 ||
    choices.length < MIN_CHOICES ||
    choices.length > MAX_CHOICES ||
    choices.includes("") ||
    new Set(choices).size !== choices.length
  ) {
    return null
  }
  return { toolCallId: toolCall.data.tool_call_id, question, choices }
}

/**
 * The questions of a conversation that are still waiting for the learner, in conversation order.
 *
 * A client tool call is closed by a `ToolOutput` message carrying its `tool_call_id`, which is
 * also how the backend records aborting one. An abort is only visible once the conversation is
 * fetched again, so a message the learner sent afterwards closes the questions before it too:
 * sending one aborts every call the turn was waiting on.
 *
 * `messages` must be in conversation order, and may mix fetched messages with ones a running
 * stream has added.
 */
export const openQuestions = (messages: ChatbotConversationMessage[]): MultipleChoiceQuestion[] => {
  const closed = new Set(
    messages.flatMap((message) => {
      const output = zChatbotConversationMessageToolOutput.safeParse(message.message)
      return output.success ? [output.data.tool_call_id] : []
    }),
  )

  let open: MultipleChoiceQuestion[] = []
  for (const message of messages) {
    const question = questionOf(message)
    if (question !== null) {
      if (!closed.has(question.toolCallId)) {
        open.push(question)
      }
      continue
    }
    const text = zChatbotConversationMessageMessage.safeParse(message.message)
    if (text.success && text.data.message_role === "user") {
      open = []
    }
  }
  return open
}
