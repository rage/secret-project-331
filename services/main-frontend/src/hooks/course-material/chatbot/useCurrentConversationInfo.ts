import { useQuery } from "@tanstack/react-query"

import { getChatbotCurrentConversationInfoOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"

const useCurrentConversationInfo = (chatbotConfigurationId: string) => {
  const anonymousToken = localStorage.getItem("anonymousToken")
  return useQuery(
    getChatbotCurrentConversationInfoOptions({
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
      },
      headers: {
        "anonymous-token": anonymousToken,
      },
    }),
  )
}

export default useCurrentConversationInfo
