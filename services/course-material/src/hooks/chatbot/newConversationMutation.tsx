import { UseQueryResult } from "@tanstack/react-query"

import { newChatbotConversation } from "@/services/backend"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

const useNewConversationMutation = (
  chatbotConfigurationId: string,
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>,
  setError: React.Dispatch<React.SetStateAction<Error | null>>,
) => {
  return useToastMutation(
    () => newChatbotConversation(chatbotConfigurationId),
    { notify: false },
    {
      onSuccess: () => {
        currentConversationInfo.refetch()
        setError(null) // Clear any existing errors when starting a new conversation
      },
    },
  )
}

export default useNewConversationMutation
