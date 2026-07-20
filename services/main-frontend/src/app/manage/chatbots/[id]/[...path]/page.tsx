"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import ChatbotConfigurationForm from "@/app/manage/courses/[id]/other/chatbot/ChatbotConfigurationForm"
import { getChatbotConfigurationOptions } from "@/generated/api/@tanstack/react-query.generated"
import Button from "@/shared-module/common/components/Button"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

const CustomizeChatbotPage = () => {
  const { t } = useTranslation()
  const router = useRouter()
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
          <Button type="button" size="medium" variant="secondary" onClick={() => router.back()}>
            {t("back")}
          </Button>
          <h1>{data.chatbot_name}</h1>
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
