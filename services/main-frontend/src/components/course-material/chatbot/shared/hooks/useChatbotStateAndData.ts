import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { omit } from "lodash"
import React, { useCallback, useEffect, useReducer, useRef, useState } from "react"
import type { Control } from "react-hook-form"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type {
  ChatbotConversation,
  ChatbotConversationInfo,
  ChatbotPageContext,
  ClientToolAnswer,
  ClientToolName,
} from "@/generated/course-material-api/types.generated"
import { isAbortError } from "@/shared-module/common/errors/AppApiError"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

import type { ChatbotEndpoints, ChatbotTurnRequest } from "../chatbotEndpoints"
import type { ChatbotAction, ChatbotState } from "../chatbotReducer"
import chatbotReducer from "../chatbotReducer"
import { CLIENT_TOOL_REGISTRY } from "../clientToolRegistry"
import { hasOpenClientToolCall } from "../messageClassification"
import readChatbotResponseStream from "../readChatbotResponseStream"

/** Which client tool call the learner answered, and with what. */
export interface ClientToolResponse {
  toolCallId: string
  toolName: ClientToolName
  answer: ClientToolAnswer
}

/** Called with what a confirmed action tool's execution sent back for this browser. */
export type ActionExecutedHandler = (toolName: ClientToolName, payload: unknown) => void

/** A turn `runTurn` refused because another is still streaming. Never surfaced to the learner. */
class TurnAlreadyRunningError extends Error {}

/** react-hook-form field name for the chatbot composer's only field. */
export const MESSAGE_FIELD = "message" as const

/** The chatbot composer's only field: the message being drafted. */
export interface ChatbotComposerValues {
  [MESSAGE_FIELD]: string
}

/// Queries, state and data needed for chatbot functionality
export interface ChatbotStateAndData {
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
  control: Control<ChatbotComposerValues>
  /** Reads the composer's current text and sends it as a new message. */
  submitMessage: () => Promise<void>
  error: unknown | null
  messageState: ChatbotState
  dispatch: (action: ChatbotAction) => void
  newConversationMutation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
  chatbotMessageAnnouncement: string
  newMessageMutation: UseMutationResult<void, unknown, string, unknown>
  toolResponseMutation: UseMutationResult<void, unknown, ClientToolResponse, unknown>
  /** Why answering a call failed, for the calls whose bubble shows it (`showsAnswerError`). */
  answerErrorByToolCallId: Readonly<Record<string, unknown>>
  /** Whether either endpoint is streaming a turn right now. */
  isTurnInFlight: boolean
  /** Ends the turn that is streaming now, without surfacing an error. Does nothing otherwise. */
  stopTurn: () => void
  setDialogOpen: React.Dispatch<boolean> | undefined
  isOpen: boolean
  convId: string | null
  setConvId: React.Dispatch<string>
  updateConversationTitleMutation: UseMutationResult<
    unknown,
    unknown,
    string | null | undefined,
    unknown
  > | null
  handlePickSuggestionMutation: UseMutationResult<void, unknown, string, unknown>
  handleSubmitMutation: UseMutationResult<void, unknown, string, unknown>
}

/**
 * Queries, state and data for one mounted chatbot talking to `endpoints`.
 *
 * `setIsOpen` is only for the chatbots that live in a dialog. `pageId` is the course material page
 * context to send with a message, or null for the callers that have no page (the chatbot command
 * center, the embed, chatbot management, and the course-settings preview) — those callers must not
 * read `currentPageIdAtom` themselves, since it is only backed by course material's own state and
 * is otherwise null there anyway.
 */
const useChatbotStateAndData = (
  endpoints: ChatbotEndpoints,
  pageId: string | null,
  isAlwaysOpen: boolean,
  onActionExecuted?: ActionExecutedHandler,
): ChatbotStateAndData => {
  const { t } = useTranslation()
  const composerForm = useForm<ChatbotComposerValues>({ defaultValues: { [MESSAGE_FIELD]: "" } })
  const [error, setError] = useState<unknown | null>(null)
  const [chatbotMessageAnnouncement, setChatbotMessageAnnouncement] = useState<string>("")
  const [answerErrorByToolCallId, setAnswerErrorByToolCallId] = useState<
    Readonly<Record<string, unknown>>
  >({})

  let [isOpen, setIsOpen] = useState(false)
  let setDialogOpen: React.Dispatch<boolean> | undefined = setIsOpen

  if (isAlwaysOpen) {
    isOpen = true
    setDialogOpen = undefined
  }

  const [messageState, dispatch] = useReducer(chatbotReducer, {
    messages: [],
    executionPayloadByToolCallId: {},
  })
  const [convId, setConvId] = useState<null | string>(null)

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

  const currentConversationIdQuery = endpoints.useCurrentConversationId()

  const activeConversationId = currentConversationIdQuery.isLoading
    ? null
    : (convId ?? currentConversationIdQuery.data)

  const currentConversationInfo = endpoints.useConversationInfo(activeConversationId)

  const newConversationMutation = endpoints.useNewConversationMutation({
    resetComposerMessage: composerForm.reset,
    setError,
    setConvId,
  })

  // .mutate call takes as an argument a string that is to be used as the conversation title
  const updateConversationTitleMutation =
    endpoints.useUpdateConversationTitleMutation(activeConversationId)

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

  /** Posts one turn and applies its response stream to the chat state. */
  const postChatbotStream = async (
    request: ChatbotTurnRequest,
    conversationId: string,
    signal: AbortSignal,
  ): Promise<void> => {
    const stream = await endpoints.postTurn(request, conversationId, signal)
    const dispatchWhileMounted = whileMounted(dispatch)
    await readChatbotResponseStream(
      stream,
      (action) => {
        // Outside `whileMounted`: what the action changed stays changed after the chat closes.
        if (action.type === "ACTION_EXECUTED" && request.kind === "toolResponse") {
          onActionExecuted?.(request.toolName, action.payload.payload)
        }
        dispatchWhileMounted(action)
      },
      whileMounted(setError),
    )
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
  const onTurnError = async (err: unknown, isShownElsewhere = false) => {
    // A refused start never touched the running turn's state, so there is nothing to settle.
    if (err instanceof TurnAlreadyRunningError) {
      return
    }
    if (!isMountedRef.current) {
      return
    }
    dispatch({ type: "TURN_ENDED" })
    const stopped = isAbortError(err)
    if (!stopped && !isShownElsewhere) {
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
        composerForm.resetField(MESSAGE_FIELD)
        const pageContext: ChatbotPageContext | undefined =
          pageId !== null ? { page_id: pageId } : undefined
        await postChatbotStream({ kind: "message", message, pageContext }, conversationId, signal)
      }),
    { notify: false },
    {
      onSuccess: settleFinishedTurn,
      onError: (err) => onTurnError(err),
    },
  )

  const handleSubmitMutation = useToastMutation(
    async (message: string) => {
      const titleIsMissing = !currentConversationInfo.data?.current_conversation?.conversation_title

      await newMessageMutation.mutateAsync(message)

      if (titleIsMissing) {
        updateConversationTitleMutation?.mutate(message)
      }
    },
    { notify: false },
  )

  const handlePickSuggestionMutation = useToastMutation(
    async (message: string) => {
      const titleIsMissing = !currentConversationInfo.data?.current_conversation?.conversation_title

      await newMessageMutation.mutateAsync(message)

      if (titleIsMissing) {
        updateConversationTitleMutation?.mutate(message)
      }
    },
    { notify: false },
  )

  const submitComposerMessage = useCallback(
    (values: ChatbotComposerValues) => handleSubmitMutation.mutate(values.message),
    [handleSubmitMutation],
  )

  const toolResponseMutation = useToastMutation(
    async ({ toolCallId, toolName, answer }: ClientToolResponse) => {
      await runTurn(async (signal) => {
        const conversationId = requireConversationId()
        setAnswerErrorByToolCallId((previous) => omit(previous, toolCallId))
        await postChatbotStream(
          { kind: "toolResponse", toolCallId, toolName, answer },
          conversationId,
          signal,
        )
      })
    },
    { notify: false },
    {
      onSuccess: settleFinishedTurn,
      onError: (err, { toolCallId, toolName }) => {
        const isShownOnBubble =
          CLIENT_TOOL_REGISTRY[toolName]?.showsAnswerError === true &&
          !(err instanceof TurnAlreadyRunningError) &&
          !isAbortError(err)
        if (isShownOnBubble && isMountedRef.current) {
          setAnswerErrorByToolCallId((previous) => ({ ...previous, [toolCallId]: err }))
        }
        return onTurnError(err, isShownOnBubble)
      },
    },
  )

  return {
    newConversationMutation,
    newMessageMutation,
    toolResponseMutation,
    answerErrorByToolCallId,
    currentConversationInfo,
    control: composerForm.control,
    submitMessage: composerForm.handleSubmit(submitComposerMessage),
    messageState,
    dispatch,
    error,
    chatbotMessageAnnouncement,
    isTurnInFlight,
    stopTurn,
    setDialogOpen,
    isOpen,
    convId,
    setConvId,
    updateConversationTitleMutation,
    handlePickSuggestionMutation,
    handleSubmitMutation,
  }
}

export default useChatbotStateAndData
