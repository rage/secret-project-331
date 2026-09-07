import { useQuery } from "@tanstack/react-query"

import { getConversationInfoOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useConversationInfo = (
  chatbotConfigurationId: string | null,
  conversationId: string | null | undefined,
  anonymousToken: string | null,
) => {
  return useQuery(
    optionalGeneratedQueryOptions({
      value: chatbotConfigurationId,
      isReady: (c): c is string => Boolean(c),
      build: (c) =>
        getConversationInfoOptions({
          path: {
            chatbot_configuration_id: c,
          },
          query: {
            ...includeIf(conversationId !== null && conversationId !== undefined, {
              conversation_id: conversationId,
            }),
          },
          ...(anonymousToken && {
            headers: {
              authorization: `Bearer ${anonymousToken}`,
            },
          }),
        }),
    }),
  )
}

export default useConversationInfo
