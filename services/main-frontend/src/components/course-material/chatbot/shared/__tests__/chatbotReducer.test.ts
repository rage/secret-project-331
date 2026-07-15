import { merge } from "lodash"
import { v4 } from "uuid"

import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"

import type { ChatbotState } from "../chatbotReducer"
import chatbotReducer from "../chatbotReducer"

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
    expect(newState.messages[0]!.optimistic).toBe(true)
    expect(newState.messages[0]).toMatchObject({ optimistic: true, finished: true })
    expect(newState.messages[0]!.message.message).toMatchObject({
      text: "Lol",
      message_role: "user",
    })
  })
  it("works with USER_SENDS_MESSAGE when there's some messages", () => {
    const initialState: ChatbotState = {
      messages: [{ finished: true, message: messageFactory(), optimistic: false }],
    }
    const newState = chatbotReducer(initialState, {
      type: "USER_SENDS_MESSAGE",
      payload: "Lol",
    })

    expect(newState.messages.length).toBe(2)
    expect(newState.messages[1]!.optimistic).toBe(true)
    expect(newState.messages[1]).toMatchObject({ optimistic: true, finished: true })
    expect(newState.messages[1]!.message.message).toMatchObject({
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
    expect(newState.messages[1]!.message).toMatchObject({
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
    expect(newState.messages[1]!.message).toMatchObject({
      id: streamingMessageId,
      message: { text: "Lol", message_role: "assistant" },
    })
  })
  it("works with TOOL_CALL_IN_PROGRESS when there is no tool call in progress", () => {
    const initialState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory({}, "toolCall"), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
      ],
    }
    const newState = chatbotReducer(initialState, {
      type: "TOOL_CALL_IN_PROGRESS",
      payload: { arguments: "", tool_call_id: "id", tool_name: "test_tool", finished: false },
    })
    expect(newState.messages.length).toBe(5)
    expect(newState.messages[4]).toMatchObject({ finished: false, optimistic: false })
    expect(newState.messages[4]!.message).toMatchObject({
      message: { tool_call_id: "id", tool_name: "test_tool" },
    })
  })
  it("works with TOOL_CALL_IN_PROGRESS when there is a tool call in progress", () => {
    const initialState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: false, message: messageFactory({}, "toolCall"), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
      ],
    }
    const newState = chatbotReducer(initialState, {
      type: "TOOL_CALL_IN_PROGRESS",
      payload: { arguments: "", tool_call_id: "id", tool_name: "test_tool", finished: false },
    })
    expect(newState.messages.length).toBe(5)
    expect(newState.messages[4]).toMatchObject({ finished: false, optimistic: false })
    expect(newState.messages[4]!.message).toMatchObject({
      message: { tool_call_id: "id", tool_name: "test_tool" },
    })
  })
  it("works with TOOL_CALL_FINISHED when there is a tool call in progress", () => {
    const initialState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
        {
          finished: false,
          message: messageFactory({ message: { tool_call_id: "test_id" } }, "toolCall"),
          optimistic: false,
        },
        { finished: true, message: messageFactory(), optimistic: false },
      ],
    }
    const newState = chatbotReducer(initialState, {
      type: "TOOL_CALL_FINISHED",
      payload: { tool_call_id: "test_id" },
    })
    expect(newState.messages.length).toBe(4)
    expect(newState.messages[2]).toMatchObject({ finished: true, optimistic: false })
    expect(newState.messages[2]!.message).toMatchObject({
      message: { tool_call_id: "test_id" },
    })
  })
  it("works with TOOL_CALL_FINISHED when there is more than one tool call in progress", () => {
    const initialState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
        {
          finished: false,
          message: messageFactory({ message: { tool_call_id: "test_id_1" } }, "toolCall"),
          optimistic: false,
        },
        { finished: true, message: messageFactory(), optimistic: false },
        {
          finished: false,
          message: messageFactory({ message: { tool_call_id: "test_id_2" } }, "toolCall"),
          optimistic: false,
        },
      ],
    }
    const newState = chatbotReducer(initialState, {
      type: "TOOL_CALL_FINISHED",
      payload: { tool_call_id: "test_id_1" },
    })
    expect(newState.messages.length).toBe(5)
    expect(newState.messages[2]).toMatchObject({ finished: true, optimistic: false })
    expect(newState.messages[2]!.message).toMatchObject({
      message: { tool_call_id: "test_id_1" },
    })
    expect(newState.messages[4]).toMatchObject({ finished: false, optimistic: false })
    expect(newState.messages[4]!.message).toMatchObject({
      message: { tool_call_id: "test_id_2" },
    })
  })
  it("works with REASONING_IN_PROGRESS when there is no reasoning in progress", () => {
    const initialState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
      ],
    }
    const newState = chatbotReducer(initialState, {
      type: "REASONING_IN_PROGRESS",
      payload: { reasoning_id: "id" },
    })
    expect(newState.messages.length).toBe(4)
    expect(newState.messages[3]).toMatchObject({ finished: false, optimistic: false })
    expect(newState.messages[3]!.message).toMatchObject({ message: { reasoning_id: "id" } })
  })
  it("works with REASONING_IN_PROGRESS when there is a reasoning in progress", () => {
    const initialState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
        {
          finished: false,
          message: messageFactory({ message: { reasoning_id: "id_1" } }, "reasoning"),
          optimistic: false,
        },
      ],
    }
    const newState = chatbotReducer(initialState, {
      type: "REASONING_IN_PROGRESS",
      payload: { reasoning_id: "id_2" },
    })
    expect(newState.messages.length).toBe(4)
    expect(newState.messages[3]).toMatchObject({ finished: false, optimistic: false })
    expect(newState.messages[3]!.message).toMatchObject({ message: { reasoning_id: "id_2" } })
    expect(newState.messages[2]).toMatchObject({ finished: false, optimistic: false })
    expect(newState.messages[2]!.message).toMatchObject({ message: { reasoning_id: "id_1" } })
  })
  it("works with REASONING_FINISHED when there is a reasoning in progress", () => {
    const initialState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
        {
          finished: false,
          message: messageFactory({ message: { reasoning_id: "id_1" } }, "reasoning"),
          optimistic: false,
        },
      ],
    }
    const newState = chatbotReducer(initialState, {
      type: "REASONING_FINISHED",
      payload: { reasoning_id: "id_1" },
    })
    expect(newState.messages.length).toBe(3)
    expect(newState.messages[2]).toMatchObject({ finished: true, optimistic: false })
    expect(newState.messages[2]!.message).toMatchObject({ message: { reasoning_id: "id_1" } })
  })
  it("works with REASONING_FINISHED when there is more than one reasoning in progress", () => {
    const initialState: ChatbotState = {
      messages: [
        { finished: true, message: messageFactory(), optimistic: false },
        { finished: true, message: messageFactory(), optimistic: false },
        {
          finished: false,
          message: messageFactory({ message: { reasoning_id: "id_1" } }, "reasoning"),
          optimistic: false,
        },
        {
          finished: false,
          message: messageFactory({ message: { reasoning_id: "id_2" } }, "reasoning"),
          optimistic: false,
        },
      ],
    }
    const newState = chatbotReducer(initialState, {
      type: "REASONING_FINISHED",
      payload: { reasoning_id: "id_1" },
    })
    expect(newState.messages.length).toBe(4)
    expect(newState.messages[2]).toMatchObject({ finished: true, optimistic: false })
    expect(newState.messages[2]!.message).toMatchObject({ message: { reasoning_id: "id_1" } })
    expect(newState.messages[3]).toMatchObject({ finished: false, optimistic: false })
    expect(newState.messages[3]!.message).toMatchObject({ message: { reasoning_id: "id_2" } })
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

type MessageType = "text" | "toolCall" | "reasoning"

const time = new Date(1781790266 * 1000).toISOString()

function messageFactory(
  messageFields?: RecursivePartial<ChatbotConversationMessage>,
  /// Defaults to text message (ChatbotConversationMessageMessage)
  type?: MessageType,
): ChatbotConversationMessage {
  let defaultMessage: ChatbotConversationMessage
  switch (type) {
    case "reasoning":
      defaultMessage = {
        id: "",
        message: {
          id: "22d5ea64-3766-4fcb-89df-5d5f439587c2",
          created_at: time,
          updated_at: time,
          deleted_at: null,
          chatbot_conversation_message_id: "71832a5f-b79b-4af3-8a00-07368262b2af",
          response_id: "",
          reasoning_id: "",
        },
        created_at: time,
        updated_at: time,
        deleted_at: null,
        conversation_id: "",
        order_number: 0,
      }
      break
    case "toolCall":
      defaultMessage = {
        id: "",
        message: {
          id: "22d5ea64-3766-4fcb-89df-5d5f439587c2",
          created_at: time,
          updated_at: time,
          deleted_at: null,
          chatbot_conversation_message_id: "71832a5f-b79b-4af3-8a00-07368262b2af",
          response_id: "",
          tool_arguments: "",
          tool_call_id: "call_id",
          tool_kind: "function",
          tool_name: "my_tool",
        },
        created_at: time,
        updated_at: time,
        deleted_at: null,
        conversation_id: "",
        order_number: 0,
      }
      break
    default:
      defaultMessage = {
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
  }

  return merge(defaultMessage, messageFields) as ChatbotConversationMessage
}
