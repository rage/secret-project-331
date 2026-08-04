import { useQuery } from "@tanstack/react-query"

import { getChatbotCurrentConversationInfoOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"

const useCurrentConversationInfo = (
  chatbotConfigurationId: string,
  anonymousToken: string | null,
) => {
  return useQuery(
    getChatbotCurrentConversationInfoOptions({
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
      },
      headers: {
        authorization: `Bearer ${anonymousToken}`,
      },
    }),
  )
}

export default useCurrentConversationInfo
