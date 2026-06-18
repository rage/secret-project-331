import { merge } from "lodash"
import { v4 } from "uuid"

import chatbotReducer, { ChatbotState } from "../chatbotReducer"

import { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"

describe("chatbotReducer", () => {
  it("works with RECEIVED_CONVERSATION_MESSAGES", () => {
    const newMessages: ChatbotConversationMessage[] = [messageFactory(), messageFactory()]
    const initialState: ChatbotState = { messages: [] }
    const newState = chatbotReducer(initialState, {
      type: "RECEIVED_CONVERSATION_MESSAGES",
      payload: newMessages,
    })
    const expectedState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
      ],
    }
    expect(newState).toStrictEqual(expectedState)
  })
  it("works with USER_SENDS_MESSAGE when there's no messages", () => {
    const initialState: ChatbotState = { messages: [] }
    const newState = chatbotReducer(initialState, {
      type: "USER_SENDS_MESSAGE",
      payload: "Lol",
    })

    expect(newState.messages.length).toBe(1)
    expect(newState.messages[0].optimistic).toBe(true)
    expect(newState.messages[0]).toMatchObject({ optimistic: true, finished: true })
    expect(newState.messages[0].message.message).toMatchObject({
      text: "Lol",
      message_role: "user",
    })
  })
  it("works with USER_SENDS_MESSAGE when there's no messages", () => {
    const initialState: ChatbotState = {
      messages: [{ finished: true, message: messageFactory(), optimistic: false }],
    }
    const newState = chatbotReducer(initialState, {
      type: "USER_SENDS_MESSAGE",
      payload: "Lol",
    })

    expect(newState.messages.length).toBe(2)
    expect(newState.messages[1].optimistic).toBe(true)
    expect(newState.messages[1]).toMatchObject({ optimistic: true, finished: true })
    expect(newState.messages[1].message.message).toMatchObject({
      text: "Lol",
      message_role: "user",
    })
  })
  it("works with RECEIVED_TEXT_DELTA when there's no streamed message", () => {
    const initialState: ChatbotState = {
      messages: [{ finished: true, message: messageFactory(), optimistic: false }],
    }
    const streamingMessageId = v4()
    const newState = chatbotReducer(initialState, {
      type: "RECEIVED_TEXT_DELTA",
      payload: { text: "Lol", message_id: streamingMessageId },
    })
    expect(newState.messages.length).toBe(2)
    expect(newState.messages[1]).toMatchObject({ finished: false, optimistic: false })
    expect(newState.messages[1].message).toMatchObject({
      id: streamingMessageId,
      message: { text: "Lol", message_role: "assistant" },
    })
  })
  it("works with RECEIVED_TEXT_DELTA when there is a streamed message", () => {
    const streamingMessageId = v4()
    const initialState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        {
          finished: false,
          message: messageFactory({
            id: streamingMessageId,
            message: { text: "Lo", message_role: "assistant" },
          }),
          optimistic: false,
        },
      ],
    }
    const newState = chatbotReducer(initialState, {
      type: "RECEIVED_TEXT_DELTA",
      payload: { text: "l", message_id: streamingMessageId },
    })
    expect(newState.messages.length).toBe(2)
    expect(newState.messages[1]).toMatchObject({ finished: false, optimistic: false })
    expect(newState.messages[1].message).toMatchObject({
      id: streamingMessageId,
      message: { text: "Lol", message_role: "assistant" },
    })
  })
  it("works with TOOL_CALL_IN_PROGRESS when there is no tool call in progress", () => {
    // put a finished tool call in the state
  })
  it("works with TOOL_CALL_IN_PROGRESS when there is a tool call in progress", () => {
    // put a finished tool call in the state
  })
})

/// Allows to you to set only some  fields of an object and leave others empty
/// Works with nested objects (recursive)
type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
      ? RecursivePartial<T[P]>
      : T[P]
}

const time = new Date(1781790266 * 1000).toISOString()

function messageFactory(
  messageFields?: RecursivePartial<ChatbotConversationMessage>,
): ChatbotConversationMessage {
  const defaultMessage: ChatbotConversationMessage = {
    id: "",
    message: {
      id: "22d5ea64-3766-4fcb-89df-5d5f439587c2",
      text: "",
      message_role: "assistant",
      created_at: time,
      updated_at: time,
      deleted_at: null,
      chatbot_conversation_message_id: "71832a5f-b79b-4af3-8a00-07368262b2af",
      message_is_complete: true,
      response_id: null,
      used_tokens: 0,
    },
    created_at: time,
    updated_at: time,
    deleted_at: null,
    conversation_id: "",
    order_number: 0,
  }
  return merge(defaultMessage, messageFields) as ChatbotConversationMessage
}
