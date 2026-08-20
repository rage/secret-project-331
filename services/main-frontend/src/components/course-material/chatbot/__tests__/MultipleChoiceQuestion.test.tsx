"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { v4 } from "uuid"

import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"
import { setupIntersectionObserverMock } from "@/shared-module/common/test-utils/mockIntersectionObserver"

import {
  CONVERSATION_ID,
  conversationMessage,
  makeChatBodyProps,
  TIME,
} from "../__fixtures__/chatBodyProps"
import ChatbotChatBody from "../shared/ChatbotChatBody"
import {
  multipleChoiceAnswer,
  ASK_MULTIPLE_CHOICE_QUESTION_TOOL,
} from "../shared/multipleChoiceQuestions"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.

// jsdom lacks IntersectionObserver, needed by TextAreaField's auto-resize inside ChatbotChatBody.
beforeAll(setupIntersectionObserverMock)

const TOOL_CALL_ID = "call_abc123"
const QUESTION = "Which loop do you mean?"
const CHOICES = ["while loops", "for loops"]
const SUGGESTION_ID = "22222222-2222-4222-8222-222222222222"
const SUGGESTION = "What is a nested loop?"

const questionMessage = (
  orderNumber: number,
  toolArguments: string = JSON.stringify({ question: QUESTION, choices: CHOICES }),
): ChatbotConversationMessage => {
  const id = v4()
  return {
    conversation_id: CONVERSATION_ID,
    created_at: TIME,
    deleted_at: null,
    id,
    message: {
      chatbot_conversation_message_id: id,
      created_at: TIME,
      deleted_at: null,
      id: v4(),
      response_id: "resp_1",
      tool_arguments: toolArguments,
      tool_call_id: TOOL_CALL_ID,
      tool_kind: "client_tool",
      tool_name: ASK_MULTIPLE_CHOICE_QUESTION_TOOL,
      updated_at: TIME,
    },
    order_number: orderNumber,
    updated_at: TIME,
  }
}

const PICKED_FOR_LOOPS = { choice_index: 1 }

const answerMessage = (
  orderNumber: number,
  clientAnswer: Record<string, unknown> | null = PICKED_FOR_LOOPS,
): ChatbotConversationMessage => {
  const id = v4()
  return {
    conversation_id: CONVERSATION_ID,
    created_at: TIME,
    deleted_at: null,
    id,
    message: {
      chatbot_conversation_message_id: id,
      client_answer: clientAnswer,
      created_at: TIME,
      deleted_at: null,
      id: v4(),
      output: "Result: [output]Asked a question and got an answer.[/output]",
      response_id: "resp_1",
      tool_call_id: TOOL_CALL_ID,
      tool_kind: "client_tool",
      updated_at: TIME,
    },
    order_number: orderNumber,
    updated_at: TIME,
  }
}

const askedQuestion = (): ChatbotConversationMessage[] => [
  conversationMessage({ role: "user", text: "Tell me about loops", orderNumber: 1 }),
  questionMessage(2),
]

describe("Clarifying question from the chatbot", () => {
  it("names the question group after the question and offers every choice as a button", () => {
    render(<ChatbotChatBody {...makeChatBodyProps({ messages: askedQuestion() }).props} />)

    const group = screen.getByRole("group", { name: QUESTION })
    for (const choice of CHOICES) {
      expect(screen.getByRole("button", { name: choice })).toBeEnabled()
    }
    expect(group).toHaveTextContent("chatbot-question-pick-an-answer")
  })

  it("identifies the question as the chatbot's to a screen reader", () => {
    render(<ChatbotChatBody {...makeChatBodyProps({ messages: askedQuestion() }).props} />)

    expect(screen.getByRole("listitem", { name: "question-from-the-chatbot" })).toHaveTextContent(
      QUESTION,
    )
  })

  // The conversation is the only place a suspended turn is recorded, so this is also what a reload
  // recovers the question from.
  it("answers with the position of the chosen choice", () => {
    const { props, answer } = makeChatBodyProps({ messages: askedQuestion() })
    render(<ChatbotChatBody {...props} />)

    fireEvent.click(screen.getByRole("button", { name: "for loops" }))

    expect(answer).toHaveBeenCalledWith({
      toolCallId: TOOL_CALL_ID,
      answer: multipleChoiceAnswer(1),
    })
  })

  it("hands focus to the message field, which outlives the choices", () => {
    render(<ChatbotChatBody {...makeChatBodyProps({ messages: askedQuestion() }).props} />)

    fireEvent.click(screen.getByRole("button", { name: "for loops" }))

    expect(screen.getByPlaceholderText("label-message")).toHaveFocus()
  })

  it("disables the choices while a message is streaming, before the call is stored", () => {
    const { props } = makeChatBodyProps({ messages: askedQuestion(), isTurnInFlight: true })
    render(<ChatbotChatBody {...props} />)

    for (const choice of CHOICES) {
      expect(screen.getByRole("button", { name: choice })).toBeDisabled()
    }
    expect(screen.getByRole("group", { name: QUESTION })).toHaveAttribute("aria-busy", "true")
  })

  it("keeps the choices visible but disabled, with the chosen one marked, once answered", () => {
    const { props } = makeChatBodyProps({ messages: [...askedQuestion(), answerMessage(3)] })
    render(<ChatbotChatBody {...props} />)

    const group = screen.getByRole("group", { name: QUESTION })
    expect(group).toHaveTextContent("chatbot-question-answered")

    const chosen = screen.getByRole("button", { name: /for loops/ })
    expect(chosen).toBeDisabled()
    expect(chosen).toHaveAttribute("aria-pressed", "true")
    expect(chosen).toHaveTextContent("chatbot-question-your-answer")

    const notChosen = screen.getByRole("button", { name: "while loops" })
    expect(notChosen).toBeDisabled()
    expect(notChosen).toHaveAttribute("aria-pressed", "false")
  })

  // An aborted call, and an answer from before the backend stored answers, both arrive without
  // one. Neither says which choice the learner picked, so none is marked.
  it("marks no choice when the closed call carries no stored answer", () => {
    const { props } = makeChatBodyProps({ messages: [...askedQuestion(), answerMessage(3, null)] })
    render(<ChatbotChatBody {...props} />)

    for (const choice of CHOICES) {
      const button = screen.getByRole("button", { name: choice })
      expect(button).toBeDisabled()
      expect(button).not.toHaveAttribute("aria-pressed")
    }
  })

  // A new message aborts the call server-side, and the abort is only visible after a refetch.
  // Nothing in the conversation says which choice, if any, the learner was about to pick, so no
  // choice is marked: the question just stops being answerable.
  it("disables the choices, with none marked, as soon as the learner writes instead", () => {
    const { props } = makeChatBodyProps({
      messages: [
        ...askedQuestion(),
        conversationMessage({ role: "user", text: "Never mind, explain both", orderNumber: 3 }),
      ],
    })
    render(<ChatbotChatBody {...props} />)

    expect(screen.getByRole("group", { name: QUESTION })).toHaveTextContent(
      "chatbot-question-closed",
    )
    for (const choice of CHOICES) {
      const button = screen.getByRole("button", { name: choice })
      expect(button).toBeDisabled()
      // Unset, not "false": nothing here claims to know whether this was or wasn't the answer.
      expect(button).not.toHaveAttribute("aria-pressed")
    }
  })

  it("highlights the clicked choice immediately, before the server confirms it", () => {
    const { props } = makeChatBodyProps({ messages: askedQuestion() })
    render(<ChatbotChatBody {...props} />)

    fireEvent.click(screen.getByRole("button", { name: "for loops" }))

    const chosen = screen.getByRole("button", { name: /for loops/ })
    expect(chosen).toHaveAttribute("aria-pressed", "true")
    expect(chosen).toHaveTextContent("chatbot-question-your-answer")
    expect(screen.getByRole("button", { name: "while loops" })).toBeDisabled()
  })

  it("leaves the message field usable while a question is waiting", () => {
    render(<ChatbotChatBody {...makeChatBodyProps({ messages: askedQuestion() }).props} />)

    expect(screen.getByPlaceholderText("label-message")).toBeEnabled()
  })

  // The suggestions were fetched for an earlier state of the conversation, so they can outlive the
  // moment they made sense in.
  it("does not offer what to ask next while a question is waiting", () => {
    const { props } = makeChatBodyProps({
      messages: askedQuestion(),
      suggestedMessages: [{ id: SUGGESTION_ID, message: SUGGESTION }],
    })
    render(<ChatbotChatBody {...props} />)

    expect(screen.queryByRole("button", { name: SUGGESTION })).toBeNull()
  })

  it("offers what to ask next again once the question has been answered", () => {
    const { props } = makeChatBodyProps({
      messages: [
        ...askedQuestion(),
        answerMessage(3),
        conversationMessage({ role: "assistant", text: "For loops it is", orderNumber: 4 }),
      ],
      suggestedMessages: [{ id: SUGGESTION_ID, message: SUGGESTION }],
    })
    render(<ChatbotChatBody {...props} />)

    expect(screen.getByRole("button", { name: SUGGESTION })).toBeInTheDocument()
  })

  // The model can emit arguments the backend only rejects once an answer for them arrives.
  it("does not offer a question whose choices the model left out", () => {
    const { props } = makeChatBodyProps({
      messages: [questionMessage(1, JSON.stringify({ question: QUESTION, choices: [] }))],
    })
    render(<ChatbotChatBody {...props} />)

    expect(screen.queryByRole("group", { name: QUESTION })).toBeNull()
  })
})
