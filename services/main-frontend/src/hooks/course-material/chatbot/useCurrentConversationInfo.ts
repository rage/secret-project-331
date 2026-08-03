import { useQuery } from "@tanstack/react-query"

import { getChatbotCurrentConversationInfoOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"

const useCurrentConversationInfo = (chatbotConfigurationId: string) => {
  const anonymousId = localStorage.getItem("anonymous_id")
  return useQuery(
    getChatbotCurrentConversationInfoOptions({
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
      },
      headers: {
        "anonymous-id": anonymousId,
      },
    }),
  )
}

export default useCurrentConversationInfo
