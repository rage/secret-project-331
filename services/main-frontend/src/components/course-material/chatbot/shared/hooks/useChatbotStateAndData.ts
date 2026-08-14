import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useReducer, useState } from "react"
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
      url,
    })
    await readChatbotResponseStream(stream, dispatch, setError)
    return stream
  }

  /**
   * A turn can fail after the server has already changed the conversation, and for an answer the
   * backend refuses only the refetched conversation says whether the question is still waiting.
   */
  const onTurnError = async (err: unknown) => {
    setError(err)
    dispatch({ type: "RESPONSE_COMPLETED" })
    await currentConversationInfo.refetch()
  }

  const newMessageMutation = useToastMutation(
    async (messageToSend: string) => {
      setChatbotMessageAnnouncement("")
      setError(null)
      setIsOpen?.(true)
      const conversationId = requireConversationId()
      setChatbotMessageAnnouncement(t("chatbot-is-responding"))
      const message = messageToSend.trim()
      dispatch({ type: "USER_SENDS_MESSAGE", payload: message })
      setNewMessage("")
      const pageContext: ChatbotPageContext | undefined =
        currentPageId !== null ? { page_id: currentPageId } : undefined
      return await postChatbotStream(
        SEND_CHATBOT_MESSAGE_PATH,
        conversationId,
        omitUndefined({ message, surface, page_context: pageContext }),
      )
    },
    { notify: false },
    {
      onSuccess: settleFinishedTurn,
      onError: onTurnError,
    },
  )

  const toolResponseMutation = useToastMutation(
    async ({ toolCallId, choiceIndex }: MultipleChoiceAnswer) => {
      setChatbotMessageAnnouncement("")
      setError(null)
      const conversationId = requireConversationId()
      setChatbotMessageAnnouncement(t("chatbot-is-responding"))
      await postChatbotStream(SEND_CHATBOT_TOOL_RESPONSE_PATH, conversationId, {
        tool_call_id: toolCallId,
        surface,
        answer: multipleChoiceAnswer(choiceIndex),
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
  }
}

export default useChatbotStateAndData
