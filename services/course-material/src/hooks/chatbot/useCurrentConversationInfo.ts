// hooks/useCurrentConversationInfo.ts
import { useQuery } from "@tanstack/react-query"

import { getChatbotCurrentConversationInfo } from "@/services/backend"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"

const useCurrentConversationInfo = (chatbotConfigurationId: string) => {
  return useQuery<ChatbotConversationInfo, Error>({
    queryKey: ["currentConversationInfo", chatbotConfigurationId],
    queryFn: () => getChatbotCurrentConversationInfo(chatbotConfigurationId),
  })
}

export default useCurrentConversationInfo
