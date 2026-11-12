import { client as courseMaterialClient } from "@/generated/course-material-api/client.generated"
import type {
  SendChatbotMessageData,
  SendChatbotToolResponseData,
} from "@/generated/course-material-api/types.generated"
import useNewConversationMutation from "@/hooks/course-material/chatbot/newConversationMutation"
import useConversationInfo from "@/hooks/course-material/chatbot/useConversationInfo"
import useCurrentConversationId from "@/hooks/course-material/chatbot/useCurrentConversationId"
import useUpdateConversationTitleMutation from "@/hooks/course-material/chatbot/useUpdateConversationTitle"
import { includeIf, omitUndefined } from "@/shared-module/common/utils/nullability"
import { getSavedChatbotAnonymousToken } from "@/utils/anonymousTokenLocalStorage"

import type { ChatbotEndpoints } from "./chatbotEndpoints"

const SEND_CHATBOT_MESSAGE_PATH: SendChatbotMessageData["url"] =
  "/api/v0/course-material/chatbot/{chatbot_configuration_id}/conversations/{conversation_id}/send-message"

const SEND_CHATBOT_TOOL_RESPONSE_PATH: SendChatbotToolResponseData["url"] =
  "/api/v0/course-material/chatbot/{chatbot_configuration_id}/conversations/{conversation_id}/tool-response"

/** The course material chatbot API for one chatbot configuration. */
const courseMaterialChatbotEndpoints = (
  chatbotConfigurationId: string | null,
): ChatbotEndpoints => ({
  useCurrentConversationId: () => useCurrentConversationId(chatbotConfigurationId),
  useConversationInfo: (conversationId) =>
    useConversationInfo(chatbotConfigurationId, conversationId, getSavedChatbotAnonymousToken()),
  useNewConversationMutation: ({ resetComposerMessage, setError, setConvId }) =>
    useNewConversationMutation(chatbotConfigurationId, resetComposerMessage, setError, setConvId),
  useUpdateConversationTitleMutation: (conversationId) =>
    useUpdateConversationTitleMutation(chatbotConfigurationId, conversationId),
  postTurn: (request, conversationId, signal) => {
    // The only authentication an embedded or public conversation has, so both endpoints send it.
    const anonymousToken = getSavedChatbotAnonymousToken()
    const options = {
      parseAs: "stream" as const,
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
        conversation_id: conversationId,
      },
      ...includeIf(anonymousToken, {
        headers: {
          authorization: `Bearer ${anonymousToken}`,
        },
      }),
      responseStyle: "data" as const,
      signal,
    }
    if (request.kind === "message") {
      return courseMaterialClient.post<ReadableStream<Uint8Array>, unknown, true, "data">({
        ...options,
        url: SEND_CHATBOT_MESSAGE_PATH,
        body: omitUndefined({ message: request.message, page_context: request.pageContext }),
      })
    }
    return courseMaterialClient.post<ReadableStream<Uint8Array>, unknown, true, "data">({
      ...options,
      url: SEND_CHATBOT_TOOL_RESPONSE_PATH,
      body: {
        tool_call_id: request.toolCallId,
        tool_name: request.toolName,
        answer: request.answer,
      },
    })
  },
})

export default courseMaterialChatbotEndpoints
