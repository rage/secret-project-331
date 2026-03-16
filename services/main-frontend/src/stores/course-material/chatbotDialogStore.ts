import { atom } from "jotai"

interface CourseDefaultChatbotCommunicationChannel {
  sendNewMessage: (message: string) => Promise<void>
}

export const defaultChatbotCommunicationChannel =
  atom<CourseDefaultChatbotCommunicationChannel | null>(null)
