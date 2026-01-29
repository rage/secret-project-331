"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import ChatbotConfigurationForm from "@/app/manage/courses/[id]/other/chatbot/ChatbotConfigurationForm"
import MainFrontendBreadCrumbs from "@/components/MainFrontendBreadCrumbs"
import { getChatbotConfiguration } from "@/services/backend/chatbots"
import { ChatbotConfiguration } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CustomizeChatbotPage = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const chatbotQuery = useQuery<ChatbotConfiguration>({
    queryKey: [`chatbot`, id],
    queryFn: () => getChatbotConfiguration(assertNotNullOrUndefined(id)),
    enabled: !!id,
  })

  if (chatbotQuery.isLoading || chatbotQuery.data === undefined) {
    return <Spinner variant="medium" />
  }
  if (chatbotQuery.isError) {
    return <ErrorBanner variant="readOnly" error={chatbotQuery.error} />
  }

  return (
    <div>
      <MainFrontendBreadCrumbs organizationSlug={null} courseId={chatbotQuery.data.course_id} />
      <Button type="button" size="medium" variant="secondary" onClick={() => router.back()}>
        {t("back")}
      </Button>
      <h1>{chatbotQuery.data.chatbot_name}</h1>
      <div>
        <ChatbotConfigurationForm
          oldChatbotConf={chatbotQuery.data}
          chatbotQueryRefetch={() => chatbotQuery.refetch()}
        />
      </div>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CustomizeChatbotPage))
