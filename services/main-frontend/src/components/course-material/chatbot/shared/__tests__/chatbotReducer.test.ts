import { merge } from "lodash"

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
    const expectedState = {
      messages: [
        { finished: true, message: messageFactory() },
        { finished: true, message: messageFactory() },
      ],
    }
    expect(newState).toStrictEqual(expectedState)
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

function messageFactory(
  lol?: RecursivePartial<ChatbotConversationMessage>,
): ChatbotConversationMessage {
  const defaultMessage: ChatbotConversationMessage = {
    conversation_id: "",
    created_at: "",
    id: "",
    message: {
      chatbot_conversation_message_id: "",
      created_at: "",
      deleted_at: undefined,
      id: "",
      message_is_complete: false,
      message_role: "assistant",
      response_id: undefined,
      text: "",
      updated_at: "",
      used_tokens: 0,
    },
    order_number: 0,
    updated_at: "",
  }
  return merge(defaultMessage, lol) as ChatbotConversationMessage
}
