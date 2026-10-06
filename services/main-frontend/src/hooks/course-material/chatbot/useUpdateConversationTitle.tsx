"use client"

import { useQueryClient } from "@tanstack/react-query"

import { allUserConversationsQueryKey } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { updateTitle } from "@/generated/course-material-api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

const useUpdateConversationTitleMutation = (
  chatbotConfigurationId: string | null,
  conversationId: string | null | undefined,
) => {
  const queryClient = useQueryClient()

  return useToastMutation(
    (conversationTitle: string | null | undefined) => {
      if (!chatbotConfigurationId) {
        throw new Error("useUpdateConversationTitle called with no chatbot configuration id")
      }

      if (!conversationId) {
        throw new Error("useUpdateConversationTitle called with no conversation id")
      }

      if (!conversationTitle) {
        throw new Error("useUpdateConversationTitle called with no conversation title")
      }
      return updateTitle({
        path: {
          chatbot_configuration_id: chatbotConfigurationId,
          conversation_id: conversationId,
        },
        body: conversationTitle,
      })
    },
    { notify: false },
    {
      onSuccess: () => {
        queryClient.refetchQueries({
          queryKey: allUserConversationsQueryKey(),
        })
      },
    },
  )
}

export default useUpdateConversationTitleMutation
