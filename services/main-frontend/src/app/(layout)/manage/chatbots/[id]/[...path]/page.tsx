"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import ChatbotConfigurationForm from "@/app/(layout)/manage/courses/[id]/other/chatbot/ChatbotConfigurationForm"
import { getChatbotConfigurationOptions } from "@/generated/api/@tanstack/react-query.generated"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

const CustomizeChatbotPage = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const chatbotQuery = useQuery({
    ...getChatbotConfigurationOptions({
      path: {
        chatbot_configuration_id: assertNotNullOrUndefined(id),
      },
    }),
    enabled: !!id,
  })

  return (
    <QueryResult query={chatbotQuery}>
      {(data) => (
        <div>
          <h1>{data.chatbot_name}</h1>
          <GenericInfobox>{t("chatbot-configuration-intro")}</GenericInfobox>
          <div>
            <ChatbotConfigurationForm
              oldChatbotConf={data}
              chatbotQueryRefetch={() => chatbotQuery.refetch()}
            />
          </div>
        </div>
      )}
    </QueryResult>
  )
}

export default withErrorBoundary(withSignedIn(CustomizeChatbotPage))
