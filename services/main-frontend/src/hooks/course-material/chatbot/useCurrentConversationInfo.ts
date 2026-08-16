import { useQuery } from "@tanstack/react-query"

import { getChatbotCurrentConversationInfoOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"

const useCurrentConversationInfo = (
  chatbotConfigurationId: string,
  anonymousToken: string | null,
) => {
  return useQuery(
    getChatbotCurrentConversationInfoOptions({
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
      },
      ...includeIf(anonymousToken, {
        headers: {
          authorization: `Bearer ${anonymousToken}`,
        },
      }),
    }),
  )
}

export default useCurrentConversationInfo
