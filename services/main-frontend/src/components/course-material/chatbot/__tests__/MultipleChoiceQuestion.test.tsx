"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { v4 } from "uuid"

import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"

import ChatbotChatBody from "../shared/ChatbotChatBody"
import type { ChatbotStateAndData } from "../shared/hooks/useChatbotStateAndData"
import { ASK_MULTIPLE_CHOICE_QUESTION_TOOL } from "../shared/multipleChoiceQuestions"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.

// jsdom lacks IntersectionObserver, needed by TextAreaField's auto-resize inside ChatbotChatBody.
beforeAll(() => {
  class IntersectionObserverStub {
    public observe() {}
    public unobserve() {}
    public disconnect() {}
    public takeRecords() {
      return []
    }
  }
  ;(window as unknown as Record<string, unknown>).IntersectionObserver = IntersectionObserverStub
})

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111"
const TIME = "2024-01-01T00:00:00.000Z"
const TOOL_CALL_ID = "call_abc123"
const QUESTION = "Which loop do you mean?"
const CHOICES = ["while loops", "for loops"]
const SUGGESTION_ID = "22222222-2222-4222-8222-222222222222"
const SUGGESTION = "What is a nested loop?"

const textMessage = (
  role: "user" | "assistant",
  text: string,
  orderNumber: number,
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
      message_is_complete: true,
      message_role: role,
      response_id: null,
      text,
      updated_at: TIME,
      used_tokens: 0,
    },
    order_number: orderNumber,
    updated_at: TIME,
  }
}

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

const answerMessage = (orderNumber: number): ChatbotConversationMessage => {
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
      output: "Result: [output]The user chose something.[/output]",
      response_id: "resp_1",
      tool_call_id: TOOL_CALL_ID,
      tool_kind: "client_tool",
      updated_at: TIME,
    },
    order_number: orderNumber,
    updated_at: TIME,
  }
}

interface ChatBodyOverrides {
  messages?: ChatbotConversationMessage[]
  isAnsweringQuestion?: boolean
  isSendingMessage?: boolean
  suggestedMessages?: { id: string; message: string }[]
}

const makeChatBodyProps = ({
  messages = [textMessage("user", "Tell me about loops", 1), questionMessage(2)],
  isAnsweringQuestion = false,
  isSendingMessage = false,
  suggestedMessages = [],
}: ChatBodyOverrides = {}): { props: ChatbotStateAndData; answer: jest.Mock } => {
  const answer = jest.fn()
  const props = {
    currentConversationInfo: {
      isLoading: false,
      isError: false,
      isRefetching: false,
      data: {
        current_conversation: { id: CONVERSATION_ID },
        current_conversation_messages: messages,
        current_conversation_message_citations: [],
        hide_citations: false,
        suggested_messages: suggestedMessages,
      },
    },
    newConversationMutation: { mutate: jest.fn(), isPending: false },
    newMessage: "",
    setNewMessage: jest.fn(),
    error: null,
    messageState: { messages: [] },
    dispatch: jest.fn(),
    chatbotMessageAnnouncement: "",
    newMessageMutation: { mutate: jest.fn(), isPending: isSendingMessage },
    toolResponseMutation: { mutate: answer, isPending: isAnsweringQuestion },
  } as unknown as ChatbotStateAndData
  return { props, answer }
}

describe("Clarifying question from the chatbot", () => {
  it("names the question group after the question and offers every choice as a button", () => {
    render(<ChatbotChatBody {...makeChatBodyProps().props} />)

    const group = screen.getByRole("group", { name: QUESTION })
    for (const choice of CHOICES) {
      expect(screen.getByRole("button", { name: choice })).toBeEnabled()
    }
    expect(group).toHaveTextContent("chatbot-question-pick-an-answer")
  })

  it("identifies the question as the chatbot's to a screen reader", () => {
    render(<ChatbotChatBody {...makeChatBodyProps().props} />)

    expect(screen.getByRole("listitem", { name: "question-from-the-chatbot" })).toHaveTextContent(
      QUESTION,
    )
  })

  // The conversation is the only place a suspended turn is recorded, so this is also what a reload
  // recovers the question from.
  it("answers with the position of the chosen choice", () => {
    const { props, answer } = makeChatBodyProps()
    render(<ChatbotChatBody {...props} />)

    fireEvent.click(screen.getByRole("button", { name: "for loops" }))

    expect(answer).toHaveBeenCalledWith({ toolCallId: TOOL_CALL_ID, choiceIndex: 1 })
  })

  it("hands focus to the message field, which outlives the choices", () => {
    render(<ChatbotChatBody {...makeChatBodyProps().props} />)

    fireEvent.click(screen.getByRole("button", { name: "for loops" }))

    expect(screen.getByPlaceholderText("label-message")).toHaveFocus()
  })

  it("disables the choices while an answer is on its way", () => {
    const { props } = makeChatBodyProps({ isAnsweringQuestion: true })
    render(<ChatbotChatBody {...props} />)

    for (const choice of CHOICES) {
      expect(screen.getByRole("button", { name: choice })).toBeDisabled()
    }
    expect(screen.getByRole("group", { name: QUESTION })).toHaveAttribute("aria-busy", "true")
  })

  it("disables the choices while a message is streaming, before the call is stored", () => {
    const { props } = makeChatBodyProps({ isSendingMessage: true })
    render(<ChatbotChatBody {...props} />)

    expect(screen.getByRole("button", { name: "for loops" })).toBeDisabled()
  })

  it("stops offering the choices once the call has been answered", () => {
    const { props } = makeChatBodyProps({
      messages: [
        textMessage("user", "Tell me about loops", 1),
        questionMessage(2),
        answerMessage(3),
      ],
    })
    render(<ChatbotChatBody {...props} />)

    const group = screen.getByRole("group", { name: QUESTION })
    expect(group).toHaveTextContent("chatbot-question-closed")
    expect(screen.queryByRole("button", { name: "for loops" })).toBeNull()
  })

  // A new message aborts the call server-side, and the abort is only visible after a refetch.
  it("stops offering the choices as soon as the learner writes instead", () => {
    const { props } = makeChatBodyProps({
      messages: [
        textMessage("user", "Tell me about loops", 1),
        questionMessage(2),
        textMessage("user", "Never mind, explain both", 3),
      ],
    })
    render(<ChatbotChatBody {...props} />)

    expect(screen.getByRole("group", { name: QUESTION })).toHaveTextContent(
      "chatbot-question-closed",
    )
    expect(screen.queryByRole("button", { name: "for loops" })).toBeNull()
  })

  it("leaves the message field usable while a question is waiting", () => {
    render(<ChatbotChatBody {...makeChatBodyProps().props} />)

    expect(screen.getByPlaceholderText("label-message")).toBeEnabled()
  })

  // The suggestions were fetched for an earlier state of the conversation, so they can outlive the
  // moment they made sense in.
  it("does not offer what to ask next while a question is waiting", () => {
    const { props } = makeChatBodyProps({
      suggestedMessages: [{ id: SUGGESTION_ID, message: SUGGESTION }],
    })
    render(<ChatbotChatBody {...props} />)

    expect(screen.queryByRole("button", { name: SUGGESTION })).toBeNull()
  })

  it("offers what to ask next again once the question has been answered", () => {
    const { props } = makeChatBodyProps({
      messages: [
        textMessage("user", "Tell me about loops", 1),
        questionMessage(2),
        answerMessage(3),
        textMessage("assistant", "For loops it is", 4),
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
