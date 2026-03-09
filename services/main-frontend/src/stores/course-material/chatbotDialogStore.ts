import { UseMutationResult } from "@tanstack/react-query"
import { atom } from "jotai"

interface CourseDefaultChatbotCommunicationChannel {
  newMessageMutation: UseMutationResult<
    ReadableStream<Uint8Array<ArrayBufferLike>>,
    unknown,
    string,
    unknown
  >
}

export const defaultChatbotCommunicationChannel =
  atom<CourseDefaultChatbotCommunicationChannel | null>(null)
