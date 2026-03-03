import { atom } from "jotai"
import { atomWithMutation } from "jotai-tanstack-query"

import { MessageAction } from "@/components/course-material/chatbot/shared/ChatbotChatBody"
import { sendChatbotMessage } from "@/services/course-material/backend"

export const chatbotOpenAtom = atom<boolean>(false)

const _chatbotNewMessageAtom = atom<string>("")

export const newChatbotMessageMutationAtom = atomWithMutation(() => ({
  mutationKey: ["newChatbotMessage"],
  mutationFn: async ({
    messageToSend,
    chatbotConfigurationId,
    currentConversationId,
    dispatch,
  }: {
    messageToSend: string
    chatbotConfigurationId: string
    currentConversationId: string
    dispatch: (action: MessageAction) => void
  }) => {
    const message = messageToSend.trim()
    dispatch({ type: "SET_OPTIMISTIC_MESSAGE", payload: message })
    const stream = await sendChatbotMessage(chatbotConfigurationId, currentConversationId, message)
    const reader = stream.getReader()

    let done = false
    while (!done) {
      const { done: doneReading, value } = await reader.read()
      done = doneReading
      if (value) {
        const valueAsString = new TextDecoder().decode(value)
        const lines = valueAsString.split("\n")
        for (const line of lines) {
          if (line?.indexOf("{") !== 0) {
            continue
          }
          try {
            const parsedValue = JSON.parse(line)
            if (parsedValue.text) {
              dispatch({ type: "APPEND_STREAMING_MESSAGE", payload: parsedValue.text })
            }
          } catch (e) {
            console.error(e)
          }
        }
      }
    }
    return stream
  },
}))
