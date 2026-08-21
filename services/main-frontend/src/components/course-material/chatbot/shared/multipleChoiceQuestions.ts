import { z } from "zod"

import type {
  ChatbotConversationMessage,
  ClientToolAnswer,
  ClientToolName,
} from "@/generated/course-material-api/types.generated"
import { zChatbotConversationMessageToolCall } from "@/generated/course-material-api/zod.generated"

/**
 * The client tool this UI answers, generated from `ClientToolName` in
 * `services/headless-lms/chatbot/src/chatbot_tools/mod.rs`. A drift between the two is a compile
 * error here rather than a call that silently renders as an anonymous tool status line.
 */
export const ASK_MULTIPLE_CHOICE_QUESTION_TOOL: ClientToolName = "ask_multiple_choice_question"

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

const zMultipleChoiceQuestion = z.object({
  toolCallId: z.string(),
  question: z.string(),
  choices: z.array(z.string()),
})

/**
 * Narrows a client tool registry entry's `unknown` call back to this tool's own type. Always true
 * for a call this tool's own `parseCall` produced; exists so the registry never needs a cast to
 * cross that boundary.
 */
export const isMultipleChoiceQuestion = (call: unknown): call is MultipleChoiceQuestion =>
  zMultipleChoiceQuestion.safeParse(call).success

/**
 * The clarifying question named by a call's raw arguments, or null if they cannot be answered.
 *
 * Arguments are only validated when an answer for them arrives, so a question the learner could
 * not answer can reach us. Returning null for those keeps them out of the conversation flow as an
 * open question; the learner can still write instead, which aborts the call. This is the client
 * tool registry's `parseCall` for this tool.
 */
export const parseMultipleChoiceQuestion = (
  toolCallId: string,
  toolArguments: string,
): MultipleChoiceQuestion | null => {
  let parsedArguments: unknown
  try {
    parsedArguments = JSON.parse(toolArguments)
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
  return { toolCallId, question, choices }
}

/** The clarifying question a conversation message asks, or null if it asks none. */
export const questionOf = (message: ChatbotConversationMessage): MultipleChoiceQuestion | null => {
  const toolCall = zChatbotConversationMessageToolCall.safeParse(message.message)
  if (!toolCall.success || toolCall.data.tool_name !== ASK_MULTIPLE_CHOICE_QUESTION_TOOL) {
    return null
  }
  return parseMultipleChoiceQuestion(toolCall.data.tool_call_id, toolCall.data.tool_arguments)
}

/**
 * The answer body for a multiple choice question: the position of the choice the learner picked in
 * the list they were offered.
 *
 * The wire shape `AskMultipleChoiceQuestionTool` deserializes, in
 * `services/headless-lms/chatbot/src/chatbot_tools/client_tools/ask_multiple_choice_question.rs`.
 * `ClientToolAnswer["data"]["result"]` is generated as an open record, so this schema is the only
 * thing keeping the key from drifting away from the backend.
 */
const multipleChoiceAnswerResult = z.object({ choice_index: z.number().int().nonnegative() })

type MultipleChoiceAnswerResult = z.infer<typeof multipleChoiceAnswerResult>

/**
 * Which of a question's own choices the answer stored with its tool output names, or null if the
 * call was aborted instead of answered, was answered before answers were stored, or names a choice
 * this question does not offer.
 */
export const chosenChoiceIndex = (
  question: MultipleChoiceQuestion,
  clientAnswer: unknown,
): number | null => {
  const answer = multipleChoiceAnswerResult.safeParse(clientAnswer)
  if (!answer.success || answer.data.choice_index >= question.choices.length) {
    return null
  }
  return answer.data.choice_index
}

/**
 * The answer to send for a question, naming the picked choice by its position. The server resolves
 * the position against the choices the model offered, so the answer carries no text of its own.
 */
export const multipleChoiceAnswer = (choiceIndex: number): ClientToolAnswer => ({
  type: "Data",
  data: { result: { choice_index: choiceIndex } satisfies MultipleChoiceAnswerResult },
})
