import { useQuery } from "@tanstack/react-query"

import { getConversationInfoOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"

const useConversationInfo = (
  chatbotConfigurationId: string,
  conversationId: string | null,
  anonymousToken: string | null,
) => {
  return useQuery(
    getConversationInfoOptions({
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
      },
      query: {
        ...includeIf(conversationId !== null, {
          conversation_id: conversationId,
        }),
      },
      ...(anonymousToken && {
        headers: {
          authorization: `Bearer ${anonymousToken}`,
        },
      }),
    }),
  )
}

export default useConversationInfo
