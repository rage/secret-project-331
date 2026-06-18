"use client"

import { produce } from "immer"
import { v4 } from "uuid"

import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"
import {
  zChatbotConversationMessageMessage,
  zChatbotConversationMessageReasoning,
  zChatbotConversationMessageToolCall,
  zChatbotConversationMessageToolOutput,
} from "@/generated/course-material-api/zod.generated"

export type ChatbotConversationMessageWithStatus = {
  message: ChatbotConversationMessage
  finished: boolean
  optimistic: boolean
}

export type ChatbotState = {
  messages: ChatbotConversationMessageWithStatus[]
}

// todo: accpt chat stream events?
export type ChatbotAction =
  | {
      type: "RECEIVED_CONVERSATION_MESSAGES"
      payload: ChatbotConversationMessage[]
    }
  | { type: "USER_SENDS_MESSAGE"; payload: string }
  | {
      type: "RECEIVED_TEXT_DELTA"
      payload: {
        message_id: string
        text: string
      }
    }
  | {
      type: "TOOL_CALL_IN_PROGRESS"
      payload: {
        arguments: string
        finished: boolean
        tool_call_id: string
        tool_name: string
      }
    }
  | { type: "TOOL_CALL_FINISHED" }
  | { type: "REASONING_IN_PROGRESS" }
  | { type: "REASONING_FINISHED" }
  | { type: "RESPONSE_COMPLETED" }

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
    if (action.type === "RECEIVED_TEXT_DELTA") {
      const streamingMessageIdx = draftState.messages.findIndex((m) => {
        return m.message.id === action.payload.message_id
      })
      const streamingMessageWithStatus = draftState.messages[streamingMessageIdx]
      const textMessageParseResult = zChatbotConversationMessageMessage.safeParse(
        streamingMessageWithStatus?.message?.message,
      )
      if (
        textMessageParseResult.success &&
        streamingMessageWithStatus &&
        !streamingMessageWithStatus.finished &&
        !streamingMessageWithStatus.optimistic
      ) {
        // if the currently streamed response already has a message in the state
        textMessageParseResult.data.text += action.payload.text
        draftState.messages[streamingMessageIdx].message.message = textMessageParseResult.data
      } else {
        // create a new message for the currently streamed response
        const lastOrderNumber = Math.max(...state.messages.map((m) => m.message.order_number), 0)

        draftState.messages.push({
          message: {
            id: action.payload.message_id,
            message: {
              id: v4(),
              text: action.payload.text,
              // eslint-disable-next-line i18next/no-literal-string
              message_role: "assistant",
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
          finished: false,
          optimistic: false,
        })
      }
    }
    if (action.type === "TOOL_CALL_IN_PROGRESS") {
      const toolCallMessageIdx = draftState.messages.findIndex((m) => {
        let res = zChatbotConversationMessageToolCall.safeParse(m.message.message)
        return res.success && res.data.tool_call_id === action.payload.tool_call_id && !m.finished
      })
      if (toolCallMessageIdx !== -1) {
        // tool call found
        let toolCall = draftState.messages[toolCallMessageIdx].message.message
        let res = zChatbotConversationMessageToolCall.safeParse(toolCall)
        if (!res.success) {
          return
        }
        // update arguments for the tool call
        res.data.tool_arguments = action.payload.arguments
        draftState.messages[toolCallMessageIdx].message.message = res.data
      } else {
        // create new message
        const lastOrderNumber = Math.max(...state.messages.map((m) => m.message.order_number), 0)

        draftState.messages.push({
          message: {
            id: v4(),
            message: {
              id: v4(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
              chatbot_conversation_message_id: v4(),
              response_id: "",
              tool_arguments: action.payload.arguments,
              tool_call_id: action.payload.tool_call_id,
              // eslint-disable-next-line i18next/no-literal-string
              tool_kind: "function",
              tool_name: action.payload.tool_name,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
            conversation_id: "",
            order_number: lastOrderNumber + 1,
          },
          finished: false,
          optimistic: false,
        })
      }
    }
  })
}

export default chatbotReducer
