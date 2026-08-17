import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useEffect, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { client as courseMaterialClient } from "@/generated/course-material-api/client.generated"
import type {
  ChatbotConversation,
  ChatbotConversationInfo,
  ChatbotPageContext,
  ChatbotSurface,
  ClientToolAnswer,
  SendChatbotMessageData,
  SendChatbotToolResponseData,
} from "@/generated/course-material-api/types.generated"
import useNewConversationMutation from "@/hooks/course-material/chatbot/newConversationMutation"
import useCurrentConversationInfo from "@/hooks/course-material/chatbot/useCurrentConversationInfo"
import { isAbortError } from "@/shared-module/common/errors/AppApiError"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { includeIf, omitUndefined } from "@/shared-module/common/utils/nullability"
import { currentPageIdAtom } from "@/state/course-material/selectors"
import { getSavedChatbotAnonymousToken } from "@/utils/anonymousTokenLocalStorage"

import type { ChatbotAction, ChatbotState } from "../chatbotReducer"
import chatbotReducer from "../chatbotReducer"
import { openQuestions } from "../multipleChoiceQuestions"
import readChatbotResponseStream from "../readChatbotResponseStream"

const SEND_CHATBOT_MESSAGE_PATH: SendChatbotMessageData["url"] =
  "/api/v0/course-material/chatbot/{chatbot_configuration_id}/conversations/{conversation_id}/send-message"

const SEND_CHATBOT_TOOL_RESPONSE_PATH: SendChatbotToolResponseData["url"] =
  "/api/v0/course-material/chatbot/{chatbot_configuration_id}/conversations/{conversation_id}/tool-response"

/** Which choice of which waiting question the learner picked. */
export interface MultipleChoiceAnswer {
  toolCallId: string
  /** Position in the list of choices the question offered. */
  choiceIndex: number
}

/**
 * The wire shape `AskMultipleChoiceQuestionTool::parse_response` deserializes, in
 * `services/headless-lms/chatbot/src/chatbot_tools/client_tools/ask_multiple_choice_question.rs`.
 * `ClientToolAnswer["data"]["result"]` is generated as an open record, so this declaration and the
 * test that pins it are the only things keeping the key from drifting away from the backend.
 */
interface MultipleChoiceAnswerResult {
  choice_index: number
}

/**
 * The answer body for a multiple choice question. The index is resolved against the choices the
 * model offered on the server, so the answer never carries text the model then reads back.
 */
export const multipleChoiceAnswer = (choiceIndex: number): ClientToolAnswer => ({
  type: "Data",
  data: { result: { choice_index: choiceIndex } satisfies MultipleChoiceAnswerResult },
})

/** A turn `runTurn` refused because another is still streaming. Never surfaced to the learner. */
class TurnAlreadyRunningError extends Error {}

/// Queries, state and data needed for chatbot functionality
export interface ChatbotStateAndData {
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
  newMessage: string
  setNewMessage: React.Dispatch<React.SetStateAction<string>>
  error: unknown | null
  messageState: ChatbotState
  dispatch: (action: ChatbotAction) => void
  newConversationMutation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
  chatbotMessageAnnouncement: string
  newMessageMutation: UseMutationResult<
    ReadableStream<Uint8Array<ArrayBufferLike>>,
    unknown,
    string,
    unknown
  >
  toolResponseMutation: UseMutationResult<void, unknown, MultipleChoiceAnswer, unknown>
  /** Whether either endpoint is streaming a turn right now. */
  isTurnInFlight: boolean
  /** Ends the turn that is streaming now, without surfacing an error. Does nothing otherwise. */
  stopTurn: () => void
}

/**
 * Queries, state and data for one mounted chatbot.
 *
 * `surface` names the UI this chatbot is mounted in and is sent with every message; the
 * backend cannot tell the surfaces apart otherwise, because they share this endpoint and often
 * a chatbot configuration too. `setIsOpen` is only for surfaces that live in a dialog.
 */
const useChatbotStateAndData = (
  chatbotConfigurationId: string,
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>> | undefined,
  surface: ChatbotSurface,
) => {
  const { t } = useTranslation()
  // Null outside course material, where there is no page to give context about.
  const currentPageId = useAtomValue(currentPageIdAtom)
  const [newMessage, setNewMessage] = useState("")
  const [error, setError] = useState<unknown | null>(null)
  const [chatbotMessageAnnouncement, setChatbotMessageAnnouncement] = useState<string>("")
  const [messageState, dispatch] = useReducer(chatbotReducer, {
    messages: [],
  })

  const turnAbortControllerRef = useRef<AbortController | null>(null)
  // Kept in sync with the ref, at the two points the ref is armed and released.
  const [isTurnInFlight, setIsTurnInFlight] = useState(false)

  // Tracks whether a turn's output still has somewhere to go. An orphaned turn is left to run
  // rather than aborted: the server persists the answer as it streams, and cutting the request off
  // truncates what the learner comes back to.
  const isMountedRef = useRef(true)
  useEffect(() => {
    // Set again on every run: the cleanup also runs on a Strict Mode remount of the same hook.
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /** Applies a turn's output, dropping what arrives once nothing is mounted to show it. */
  const whileMounted =
    <A extends unknown[]>(apply: (...args: A) => void) =>
    (...args: A) => {
      if (isMountedRef.current) {
        apply(...args)
      }
    }

  const anonymousToken = getSavedChatbotAnonymousToken()

  const currentConversationInfo = useCurrentConversationInfo(chatbotConfigurationId, anonymousToken)
  const newConversationMutation = useNewConversationMutation(
    chatbotConfigurationId,
    currentConversationInfo,
    setNewMessage,
    setError,
  )

  /**
   * Takes the conversation as the ended turn left it and announces what the learner is expected to
   * do next, which is answer a question if the turn suspended on one.
   */
  const settleFinishedTurn = async () => {
    if (!isMountedRef.current) {
      return
    }
    const refetched = await currentConversationInfo.refetch()
    dispatch({ type: "RESPONSE_COMPLETED" })
    const waiting = openQuestions(refetched.data?.current_conversation_messages ?? [])
    setChatbotMessageAnnouncement(
      waiting.length > 0 ? t("chatbot-asked-a-question") : t("chatbot-finished-responding"),
    )
  }

  const requireConversationId = () => {
    const conversation = currentConversationInfo.data?.current_conversation
    if (!conversation) {
      throw new Error("No active conversation")
    }
    return conversation.id
  }

  /**
   * Posts to one of the two chatbot turn endpoints and applies the response stream to the chat
   * state. Shared so the anonymous token, which is the only authentication an embedded or public
   * conversation has, cannot end up sent by one endpoint and not the other.
   */
  const postChatbotStream = async (
    url: typeof SEND_CHATBOT_MESSAGE_PATH | typeof SEND_CHATBOT_TOOL_RESPONSE_PATH,
    conversationId: string,
    body: unknown,
    signal: AbortSignal,
  ) => {
    const stream = await courseMaterialClient.post<
      ReadableStream<Uint8Array>,
      unknown,
      true,
      "data"
    >({
      body,
      parseAs: "stream",
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
        conversation_id: conversationId,
      },
      ...includeIf(anonymousToken, {
        headers: {
          authorization: `Bearer ${anonymousToken}`,
        },
      }),
      responseStyle: "data",
      signal,
      url,
    })
    await readChatbotResponseStream(stream, whileMounted(dispatch), whileMounted(setError))
    return stream
  }

  /**
   * Runs `send` as the one turn in flight: clears the last turn's leftovers and hands `send` the
   * signal `stopTurn` aborts, which it has to send with its request. Both endpoints go through it,
   * because a turn left armed by a throw on the way to the request refuses every later turn in
   * silence.
   *
   * Rejects with `TurnAlreadyRunningError`, leaving the running turn untouched, rather than let a
   * second turn take over the first one's controller and reducer state.
   */
  const runTurn = async <T>(send: (signal: AbortSignal) => Promise<T>) => {
    if (turnAbortControllerRef.current !== null) {
      throw new TurnAlreadyRunningError()
    }
    setChatbotMessageAnnouncement(t("chatbot-is-responding"))
    setError(null)
    const controller = new AbortController()
    turnAbortControllerRef.current = controller
    setIsTurnInFlight(true)
    try {
      return await send(controller.signal)
    } finally {
      // Unconditional: a refused turn throws above, so it never reaches this cleanup and cannot
      // release the controller the running turn is stopped with.
      turnAbortControllerRef.current = null
      if (isMountedRef.current) {
        setIsTurnInFlight(false)
      }
    }
  }

  const stopTurn = () => {
    turnAbortControllerRef.current?.abort()
  }

  /**
   * A turn can fail after the server has already changed the conversation, and for an answer the
   * backend refuses only the refetched conversation says whether the question is still waiting.
   */
  const onTurnError = async (err: unknown) => {
    // A refused start never touched the running turn's state, so there is nothing to settle.
    if (err instanceof TurnAlreadyRunningError) {
      return
    }
    if (!isMountedRef.current) {
      return
    }
    const stopped = isAbortError(err)
    if (!stopped) {
      setError(err)
    }
    setChatbotMessageAnnouncement(
      stopped ? t("chatbot-stopped-responding") : t("failed-to-send-message"),
    )
    // Refetch first: RESPONSE_COMPLETED drops the streamed messages, so clearing them before their
    // persisted replacements have arrived makes a partial answer vanish and come back.
    await currentConversationInfo.refetch()
    dispatch({ type: "RESPONSE_COMPLETED" })
  }

  const newMessageMutation = useToastMutation(
    async (messageToSend: string) =>
      await runTurn(async (signal) => {
        setIsOpen?.(true)
        const conversationId = requireConversationId()
        const message = messageToSend.trim()
        dispatch({ type: "USER_SENDS_MESSAGE", payload: message })
        setNewMessage("")
        const pageContext: ChatbotPageContext | undefined =
          currentPageId !== null ? { page_id: currentPageId } : undefined
        return await postChatbotStream(
          SEND_CHATBOT_MESSAGE_PATH,
          conversationId,
          omitUndefined({ message, surface, page_context: pageContext }),
          signal,
        )
      }),
    { notify: false },
    {
      onSuccess: settleFinishedTurn,
      onError: onTurnError,
    },
  )

  const toolResponseMutation = useToastMutation(
    async ({ toolCallId, choiceIndex }: MultipleChoiceAnswer) => {
      await runTurn(async (signal) => {
        const conversationId = requireConversationId()
        await postChatbotStream(
          SEND_CHATBOT_TOOL_RESPONSE_PATH,
          conversationId,
          {
            tool_call_id: toolCallId,
            surface,
            answer: multipleChoiceAnswer(choiceIndex),
          },
          signal,
        )
      })
    },
    { notify: false },
    {
      onSuccess: settleFinishedTurn,
      onError: onTurnError,
    },
  )

  return {
    newConversationMutation,
    newMessageMutation,
    toolResponseMutation,
    currentConversationInfo,
    newMessage,
    setNewMessage,
    messageState,
    dispatch,
    error,
    chatbotMessageAnnouncement,
    isTurnInFlight,
    stopTurn,
  }
}

export default useChatbotStateAndData
