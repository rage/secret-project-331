import { atom } from "jotai"

interface CourseDefaultChatbotCommunicationChannel {
  /**
   * Sends a message to the course default chatbot, agreeing to the disclaimer first if the learner
   * has no conversation yet. Never rejects, so a caller firing it from a click handler needs no
   * catch; a real failure is surfaced by the chatbot's own error banner.
   */
  sendNewMessage: (message: string) => Promise<void>
}

/**
 * Used to send messages to the course default chatbot from outside of the chatbot dialog, like the
 * TextSelectionTooltip. Boxed in an object because jotai reads a bare function value as an updater.
 */
export const defaultChatbotCommunicationChannel =
  atom<CourseDefaultChatbotCommunicationChannel | null>(null)

/**
 * Whether the course default chatbot is streaming a turn. Separate from the channel so that a turn
 * starting or ending does not replace the channel.
 */
export const defaultChatbotIsTurnInFlight = atom(false)

/** Whether the course default chatbot has no channel to send through yet, or is mid-turn on it. */
export const defaultChatbotIsBusy = atom(
  (get) => get(defaultChatbotCommunicationChannel) === null || get(defaultChatbotIsTurnInFlight),
)
