"use client"

import { produce } from "immer"
import { v4 } from "uuid"

import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"

export type ChatbotConversationMessageWithStatus = {
  message: ChatbotConversationMessage
  finished: boolean
  optimistic: boolean
}

export type ChatbotState = {
  messages: ChatbotConversationMessageWithStatus[]
}

export type ChatbotAction =
  | {
      type: "RECEIVED_CONVERSATION_MESSAGES"
      payload: ChatbotConversationMessage[]
    }
  | { type: "USER_SENDS_MESSAGE"; payload: string }

const chatbotReducer = (state: ChatbotState, action: ChatbotAction): ChatbotState => {
  return produce(state, (draftState) => {
    if (action.type === "RECEIVED_CONVERSATION_MESSAGES") {
      draftState.messages = action.payload.map((m) => {
        return { message: m, finished: true, optimistic: false }
      })
    }
    if (action.type === "USER_SENDS_MESSAGE") {
      const lastOrderNumber = Math.max(...state.messages.map((m) => m.message.order_number), 0)

      draftState.messages.push({
        message: {
          id: v4(),
          message: {
            id: v4(),
            text: action.payload,
            // eslint-disable-next-line i18next/no-literal-string
            message_role: "user",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
            chatbot_conversation_message_id: v4(),
            message_is_complete: true,
            response_id: null,
            used_tokens: 0,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          conversation_id: "",
          order_number: lastOrderNumber + 1,
        },
        finished: true,
        optimistic: true,
      })
    }
  })
}

export default chatbotReducer
