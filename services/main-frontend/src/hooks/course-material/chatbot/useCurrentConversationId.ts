import { useQuery } from "@tanstack/react-query"

import { getCurrentConversationIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useCurrentConversationId = (chatbotConfigurationId: string) => {
  return useQuery(
    optionalGeneratedQueryOptions({
      value: chatbotConfigurationId,
      isReady: (c): c is string => Boolean(c),
      build: (c) =>
        getCurrentConversationIdOptions({
          path: {
            chatbot_configuration_id: c,
          },
        }),
    }),
  )
}

export default useCurrentConversationId
