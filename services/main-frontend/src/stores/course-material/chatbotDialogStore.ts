import { atom } from "jotai"

interface CourseDefaultChatbotCommunicationChannel {
  sendNewMessage: (message: string) => Promise<void>
}

/// Used to send messages to the course default chatbot from outside of the chatbot
/// dialog, like the TextSelectionTooltip
export const defaultChatbotCommunicationChannel =
  atom<CourseDefaultChatbotCommunicationChannel | null>(null)
