"use client"

import { produce } from "immer"

import { ChatbotConversationMessageWithStatus } from "./ChatbotChatBody"

import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"

export type ChatbotState = {
  messages: ChatbotConversationMessageWithStatus[]
}

export type ChatbotAction = {
  type: "RECEIVED_CONVERSATION_MESSAGES"
  payload: ChatbotConversationMessage[]
}

const chatbotReducer = (state: ChatbotState, action: ChatbotAction): ChatbotState => {
  return produce(state, (draftState) => {
    if (action.type === "RECEIVED_CONVERSATION_MESSAGES") {
      draftState.messages = action.payload.map((m) => {
        return { message: m, finished: true }
      })
    }
  })
}

export default chatbotReducer
