import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import { useTranslation } from "react-i18next"

import MainFrontendBreadCrumbs from "@/components/MainFrontendBreadCrumbs"
import ChatbotConfigurationForm from "@/components/page-specific/manage/courses/id/chatbot/ChatbotConfigurationForm"
import { configureChatbot, getChatbotConfiguration } from "@/services/backend/courses/chatbots"
import { ChatbotConfiguration, NewChatbotConf } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CustomizeChatbotPage = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = router.query

  const chatbotQuery = useQuery<ChatbotConfiguration>({
    queryKey: [`chatbot`, id],
    queryFn: () => getChatbotConfiguration(assertNotNullOrUndefined(id!.toString())),
    enabled: !!id,
  })

  const mutation = useToastMutation(
    async (bot: NewChatbotConf) => {
      if (chatbot === null) {
        throw new Error("Chatbot undefined")
      }
      await configureChatbot(chatbot.id, bot)
    },
    {
      notify: true,
      method: "POST",
      successMessage: t("default-toast-success-message"),
    },
  )

  if (chatbotQuery.isLoading) {
    return <Spinner variant="medium" />
  }
  if (chatbotQuery.isError) {
    return <ErrorBanner variant="readOnly" error={chatbotQuery.error} />
  }
  let chatbot: ChatbotConfiguration | null = null
  if (chatbotQuery.data === undefined) {
    return <ErrorBanner variant="readOnly" error={t("error-title")} />
  } else {
    chatbot = chatbotQuery.data
  }

  return (
    <div>
      <MainFrontendBreadCrumbs organizationSlug={null} courseId={chatbot.course_id} />
      <Button type="button" size="medium" variant="secondary" onClick={() => router.back()}>
        {t("back")}
      </Button>
      <h1>{chatbot.chatbot_name}</h1>
      <div>
        <ChatbotConfigurationForm
          oldChatbotConf={chatbot}
          onConfigureChatbot={(newChatbot) => {
            mutation.mutate(newChatbot)
          }}
        />
      </div>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CustomizeChatbotPage))
