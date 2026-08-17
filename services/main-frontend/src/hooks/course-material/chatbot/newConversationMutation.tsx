"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { newChatbotConversation } from "@/generated/course-material-api/sdk.generated"
import type { ChatbotConversationInfo } from "@/generated/course-material-api/types.generated"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import { normalizeErrorForDisplay } from "@/shared-module/common/errors/normalizeErrorForDisplay"
import { resolveErrorDisplayCopy } from "@/shared-module/common/errors/resolveErrorDisplayCopy"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { saveChatbotAnonymousToken } from "@/utils/anonymousTokenLocalStorage"

const useNewConversationMutation = (
  chatbotConfigurationId: string,
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>,
  setNewMessage: React.Dispatch<React.SetStateAction<string>>,
  setError: React.Dispatch<React.SetStateAction<Error | null>>,
) => {
  const { t } = useTranslation()
  return useToastMutation(
    () =>
      newChatbotConversation({
        path: {
          chatbot_configuration_id: chatbotConfigurationId,
        },
      }),
    { notify: false },
    {
      onSuccess: (res) => {
        const anonymousToken = res.anonymous_token
        saveChatbotAnonymousToken(anonymousToken)
        currentConversationInfo.refetch()
        setNewMessage("")
        setError(null) // Clear any existing errors when starting a new conversation
      },
      // A toast, not the chat's own error area: a conversation started from the text selection
      // tooltip fails before the chatbot is opened, leaving nothing mounted to show the error in.
      onError: (error) => {
        const copy = resolveErrorDisplayCopy(normalizeErrorForDisplay(error, t), t)
        showErrorNotification({ message: copy.message ?? copy.title })
      },
    },
  )
}

export default useNewConversationMutation
