import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import type { ChatbotEndpoints } from "@/components/course-material/chatbot/shared/chatbotEndpoints"
import {
  getCourseDesignerAssistantConversationInfoQueryKey,
  getCurrentCourseDesignerAssistantConversationOptions,
  getCurrentCourseDesignerAssistantConversationQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { client as mainFrontendClient } from "@/generated/api/client.generated"
import {
  getCourseDesignerAssistantConversationInfo,
  newCourseDesignerAssistantConversation,
} from "@/generated/api/sdk.generated"
import type {
  SendCourseDesignerAssistantMessageData,
  SendCourseDesignerAssistantToolResponseData,
} from "@/generated/api/types.generated"
import type { ChatbotConversationInfo } from "@/generated/course-material-api/types.generated"
import {
  errorNotificationMessage,
  showErrorNotification,
} from "@/shared-module/common/components/Notifications/notificationHelpers"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

const SEND_MESSAGE_PATH: SendCourseDesignerAssistantMessageData["url"] =
  "/api/v0/main-frontend/course-plans/{plan_id}/assistant/conversations/{conversation_id}/send-message"

const SEND_TOOL_RESPONSE_PATH: SendCourseDesignerAssistantToolResponseData["url"] =
  "/api/v0/main-frontend/course-plans/{plan_id}/assistant/conversations/{conversation_id}/tool-response"

const NO_CONVERSATION_QUERY_KEY = "courseDesignerAssistantNoConversation"

/**
 * The course design assistant API for one plan, for `ChatbotChat`. The main-frontend API
 * declares the same conversation types as the course material API; this is where one is used as
 * the other.
 */
const coursePlanAssistantEndpoints = (planId: string): ChatbotEndpoints => ({
  useCurrentConversationId: () =>
    useQuery({
      ...getCurrentCourseDesignerAssistantConversationOptions({ path: { plan_id: planId } }),
      select: (info) => info?.current_conversation?.id ?? null,
    }),
  useConversationInfo: (conversationId) => {
    const { t } = useTranslation()
    const assistantName = t("course-plans-assistant-name")
    return useQuery<ChatbotConversationInfo, Error>({
      queryKey: conversationId
        ? getCourseDesignerAssistantConversationInfoQueryKey({
            path: { plan_id: planId, conversation_id: conversationId },
          })
        : [NO_CONVERSATION_QUERY_KEY, planId, assistantName],
      queryFn: async ({ signal }) => {
        if (!conversationId) {
          // The chat shows its start screen for info without a conversation.
          return { chatbot_name: assistantName, hide_citations: true, current_conversation: null }
        }
        return await getCourseDesignerAssistantConversationInfo({
          path: { plan_id: planId, conversation_id: conversationId },
          signal,
          throwOnError: true,
        })
      },
    })
  },
  useNewConversationMutation: ({ resetComposerMessage, setError, setConvId }) => {
    const queryClient = useQueryClient()
    const { t } = useTranslation("errors")
    return useToastMutation(
      () => newCourseDesignerAssistantConversation({ path: { plan_id: planId } }),
      { notify: false },
      {
        onSuccess: async (conversation) => {
          resetComposerMessage()
          setError(null)
          setConvId(conversation.id)
          await queryClient.invalidateQueries({
            queryKey: getCurrentCourseDesignerAssistantConversationQueryKey({
              path: { plan_id: planId },
            }),
          })
        },
        onError: (error) => {
          showErrorNotification({ message: errorNotificationMessage(error, t) })
        },
      },
    )
  },
  useUpdateConversationTitleMutation: () => null,
  postTurn: (request, conversationId, signal) => {
    const options = {
      parseAs: "stream" as const,
      path: { plan_id: planId, conversation_id: conversationId },
      responseStyle: "data" as const,
      signal,
    }
    if (request.kind === "message") {
      return mainFrontendClient.post<ReadableStream<Uint8Array>, unknown, true, "data">({
        ...options,
        url: SEND_MESSAGE_PATH,
        body: { message: request.message },
      })
    }
    return mainFrontendClient.post<ReadableStream<Uint8Array>, unknown, true, "data">({
      ...options,
      url: SEND_TOOL_RESPONSE_PATH,
      body: {
        tool_call_id: request.toolCallId,
        tool_name: request.toolName,
        answer: request.answer,
      },
    })
  },
})

export default coursePlanAssistantEndpoints
