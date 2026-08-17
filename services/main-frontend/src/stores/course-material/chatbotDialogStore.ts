import { atom } from "jotai"

interface CourseDefaultChatbotCommunicationChannel {
  /**
   * Sends a message to the course default chatbot, agreeing to the disclaimer first if the learner
   * has no conversation yet. The chatbot refuses a start that would overlap a running turn, so a
   * caller reads `defaultChatbotIsTurnInFlightAtom` only to disable its own affordance.
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
export const defaultChatbotIsTurnInFlightAtom = atom(false)
