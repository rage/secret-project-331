import { v4 } from "uuid"

import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"

import { openClientToolCalls } from "../messageClassification"
import {
  ASK_MULTIPLE_CHOICE_QUESTION_TOOL,
  chosenChoiceIndex,
  questionOf,
} from "../multipleChoiceQuestions"

const TIME = "2024-01-01T00:00:00.000Z"
const CHOICES = ["while loops", "for loops"]

const envelope = (
  message: ChatbotConversationMessage["message"],
  orderNumber: number,
): ChatbotConversationMessage => ({
  conversation_id: v4(),
  created_at: TIME,
  deleted_at: null,
  id: v4(),
  message,
  order_number: orderNumber,
  updated_at: TIME,
})

const ANSWERABLE_ARGUMENTS = { question: "Which loop?", choices: CHOICES }

const question = (
  toolCallId: string,
  toolArguments: unknown = ANSWERABLE_ARGUMENTS,
  orderNumber = 1,
): ChatbotConversationMessage =>
  envelope(
    {
      chatbot_conversation_message_id: v4(),
      created_at: TIME,
      deleted_at: null,
      id: v4(),
      response_id: "resp_1",
      tool_arguments: JSON.stringify(toolArguments),
      tool_call_id: toolCallId,
      tool_kind: "client_tool",
      tool_name: ASK_MULTIPLE_CHOICE_QUESTION_TOOL,
      updated_at: TIME,
    },
    orderNumber,
  )

const toolOutput = (toolCallId: string, orderNumber: number): ChatbotConversationMessage =>
  envelope(
    {
      chatbot_conversation_message_id: v4(),
      created_at: TIME,
      deleted_at: null,
      id: v4(),
      output: "Result: [output]The question was answered.[/output]",
      response_id: "resp_1",
      tool_call_id: toolCallId,
      tool_kind: "client_tool",
      updated_at: TIME,
    },
    orderNumber,
  )

const text = (role: "user" | "assistant", orderNumber: number): ChatbotConversationMessage =>
  envelope(
    {
      chatbot_conversation_message_id: v4(),
      created_at: TIME,
      deleted_at: null,
      id: v4(),
      message_is_complete: true,
      message_role: role,
      response_id: null,
      text: "Something",
      updated_at: TIME,
      used_tokens: 0,
    },
    orderNumber,
  )

describe("questionOf", () => {
  it("reads the question and the choices out of the call arguments", () => {
    expect(questionOf(question("call_1"))).toEqual({
      toolCallId: "call_1",
      question: "Which loop?",
      choices: CHOICES,
    })
  })

  it("trims what the model wrote", () => {
    expect(
      questionOf(question("call_1", { question: "  Which loop? ", choices: [" while ", "for"] })),
    ).toEqual({ toolCallId: "call_1", question: "Which loop?", choices: ["while", "for"] })
  })

  // The list has to stay in step with `AskMultipleChoiceQuestionTool::parse_arguments`: a question
  // only one of the two rejects is a button the learner presses and gets an error back from.
  it("rejects arguments nobody could answer", () => {
    const unanswerable = [
      { question: "Which loop?", choices: [] },
      { question: "   ", choices: CHOICES },
      { question: "Which loop?", choices: ["while", " "] },
      { question: "Which loop?", choices: ["while"] },
      { question: "Which loop?", choices: ["while", "while"] },
      { question: "Which loop?", choices: ["1", "2", "3", "4", "5", "6", "7"] },
      { question: "Which loop?" },
      "Which loop?",
    ]
    for (const args of unanswerable) {
      expect(questionOf(question("call_1", args))).toBeNull()
    }
  })

  it("is null for a message that asks nothing", () => {
    expect(questionOf(text("assistant", 1))).toBeNull()
    expect(questionOf(toolOutput("call_1", 1))).toBeNull()
  })
})

describe("openClientToolCalls", () => {
  it("keeps a question that has no output yet", () => {
    const open = openClientToolCalls([text("user", 1), question("call_1", undefined, 2)])

    expect(open.map((q) => q.toolCallId)).toEqual(["call_1"])
  })

  it("closes a question its output has arrived for", () => {
    const open = openClientToolCalls([question("call_1", undefined, 1), toolOutput("call_1", 2)])

    expect(open).toEqual([])
  })

  it("closes every waiting question when the learner writes instead", () => {
    const open = openClientToolCalls([
      question("call_1", undefined, 1),
      question("call_2", undefined, 2),
      text("user", 3),
    ])

    expect(open).toEqual([])
  })

  it("keeps a question the chatbot asked after the learner's message", () => {
    const open = openClientToolCalls([
      question("call_1", undefined, 1),
      text("user", 2),
      question("call_2", undefined, 3),
    ])

    expect(open.map((q) => q.toolCallId)).toEqual(["call_2"])
  })
})

describe("chosenChoiceIndex", () => {
  const asked = { toolCallId: "call_1", question: "Which loop?", choices: CHOICES }

  it("reads the position out of the stored answer", () => {
    expect(chosenChoiceIndex(asked, { choice_index: 1 })).toBe(1)
  })

  // An aborted call, and an answer from before the backend stored answers, both arrive as null;
  // an answer naming a choice the question does not offer cannot be shown either.
  it("is null for anything that does not name one of the question's choices", () => {
    const unusable = [
      null,
      undefined,
      {},
      { choice_index: "1" },
      { choice_index: -1 },
      { choice_index: 1.5 },
      { choice_index: CHOICES.length },
    ]
    for (const clientAnswer of unusable) {
      expect(chosenChoiceIndex(asked, clientAnswer)).toBeNull()
    }
  })
})
