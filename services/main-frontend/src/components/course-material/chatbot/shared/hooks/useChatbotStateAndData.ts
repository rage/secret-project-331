import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { client as courseMaterialClient } from "@/generated/course-material-api/client.generated"
import type {
  ChatbotConversation,
  ChatbotConversationInfo,
  ChatbotPageContext,
  ClientToolAnswer,
  ClientToolName,
  SendChatbotMessageData,
  SendChatbotToolResponseData,
} from "@/generated/course-material-api/types.generated"
import useNewConversationMutation from "@/hooks/course-material/chatbot/newConversationMutation"
import useCurrentConversationInfo from "@/hooks/course-material/chatbot/useCurrentConversationInfo"
import { isAbortError } from "@/shared-module/common/errors/AppApiError"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { includeIf, omitUndefined } from "@/shared-module/common/utils/nullability"
import { getSavedChatbotAnonymousToken } from "@/utils/anonymousTokenLocalStorage"

import type { ChatbotAction, ChatbotState } from "../chatbotReducer"
import chatbotReducer from "../chatbotReducer"
import { hasOpenClientToolCall } from "../messageClassification"
import readChatbotResponseStream from "../readChatbotResponseStream"

const SEND_CHATBOT_MESSAGE_PATH: SendChatbotMessageData["url"] =
  "/api/v0/course-material/chatbot/{chatbot_configuration_id}/conversations/{conversation_id}/send-message"

const SEND_CHATBOT_TOOL_RESPONSE_PATH: SendChatbotToolResponseData["url"] =
  "/api/v0/course-material/chatbot/{chatbot_configuration_id}/conversations/{conversation_id}/tool-response"

/**
 * One turn's request, paired with the endpoint it belongs to so a message body can never be sent
 * to the tool-response endpoint or vice versa.
 */
type ChatbotTurnRequest =
  | { url: typeof SEND_CHATBOT_MESSAGE_PATH; body: SendChatbotMessageData["body"] }
  | { url: typeof SEND_CHATBOT_TOOL_RESPONSE_PATH; body: SendChatbotToolResponseData["body"] }

/** Which client tool call the learner answered, and with what. */
export interface ClientToolResponse {
  toolCallId: string
  toolName: ClientToolName
  answer: ClientToolAnswer
}

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
  newMessageMutation: UseMutationResult<void, unknown, string, unknown>
  toolResponseMutation: UseMutationResult<void, unknown, ClientToolResponse, unknown>
  /** Whether either endpoint is streaming a turn right now. */
  isTurnInFlight: boolean
  /** Ends the turn that is streaming now, without surfacing an error. Does nothing otherwise. */
  stopTurn: () => void
}

/**
 * Queries, state and data for one mounted chatbot.
 *
 * `setIsOpen` is only for the chatbots that live in a dialog. `pageId` is the course material page
 * context to send with a message, or null for the callers that have no page (the chatbot command
 * center, the embed, chatbot management, and the course-settings preview) — those callers must not
 * read `currentPageIdAtom` themselves, since it is only backed by course material's own state and
 * is otherwise null there anyway.
 */
const useChatbotStateAndData = (
  chatbotConfigurationId: string,
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>> | undefined,
  pageId: string | null,
) => {
  const { t } = useTranslation()
  const [newMessage, setNewMessage] = useState("")
  const [error, setError] = useState<unknown | null>(null)
  const [chatbotMessageAnnouncement, setChatbotMessageAnnouncement] = useState<string>("")
  const [messageState, dispatch] = useReducer(chatbotReducer, {
    messages: [],
    executionPayloadByToolCallId: {},
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
    dispatch({ type: "TURN_ENDED" })
    const refetched = await currentConversationInfo.refetch()
    dispatch({ type: "RESPONSE_COMPLETED" })
    const waiting = hasOpenClientToolCall(refetched.data?.current_conversation_messages ?? [])
    setChatbotMessageAnnouncement(
      waiting ? t("chatbot-asked-a-question") : t("chatbot-finished-responding"),
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
    request: ChatbotTurnRequest,
    conversationId: string,
    signal: AbortSignal,
  ): Promise<void> => {
    const stream = await courseMaterialClient.post<
      ReadableStream<Uint8Array>,
      unknown,
      true,
      "data"
    >({
      body: request.body,
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
      url: request.url,
    })
    await readChatbotResponseStream(stream, whileMounted(dispatch), whileMounted(setError))
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

  // Stable so React.memo on the body it is passed to can actually compare.
  const stopTurn = useCallback(() => {
    turnAbortControllerRef.current?.abort()
  }, [])

  /**
   * A turn can fail after the server already changed the conversation — e.g. it refused an
   * answer — so only a refetch can say whether the question is still waiting.
   */
  const onTurnError = async (err: unknown) => {
    // A refused start never touched the running turn's state, so there is nothing to settle.
    if (err instanceof TurnAlreadyRunningError) {
      return
    }
    if (!isMountedRef.current) {
      return
    }
    dispatch({ type: "TURN_ENDED" })
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
          pageId !== null ? { page_id: pageId } : undefined
        await postChatbotStream(
          {
            url: SEND_CHATBOT_MESSAGE_PATH,
            body: omitUndefined({ message, page_context: pageContext }),
          },
          conversationId,
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
    async ({ toolCallId, toolName, answer }: ClientToolResponse) => {
      await runTurn(async (signal) => {
        const conversationId = requireConversationId()
        await postChatbotStream(
          {
            url: SEND_CHATBOT_TOOL_RESPONSE_PATH,
            body: { tool_call_id: toolCallId, tool_name: toolName, answer },
          },
          conversationId,
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
