import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import { useTranslation } from "react-i18next"

import MainFrontendBreadCrumbs from "@/components/MainFrontendBreadCrumbs"
import ChatbotConfigurationForm from "@/components/page-specific/manage/courses/id/chatbot/ChatbotConfigurationForm"
import {
  configureChatbot,
  deleteChatbot,
  getChatbotConfiguration,
} from "@/services/backend/chatbots"
import { ChatbotConfiguration, NewChatbotConf } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { courseChatbotSettingsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CustomizeChatbotPage = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = router.query

  const chatbotQuery = useQuery<ChatbotConfiguration>({
    queryKey: [`chatbot`, id],
    queryFn: () => getChatbotConfiguration(assertNotNullOrUndefined(id?.toString())),
    enabled: !!id,
  })

  const configureChatbotMutation = useToastMutation(
    async (bot: NewChatbotConf) => {
      if (chatbotQuery.data === null) {
        throw new Error("Chatbot undefined")
      }
      await configureChatbot(assertNotNullOrUndefined(chatbotQuery.data?.id), bot)
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        chatbotQuery.refetch()
      },
    },
  )

  const deleteChatbotMutation = useToastMutation(
    async (chatbotConfigurationId: string) => await deleteChatbot(chatbotConfigurationId),
    {
      method: "DELETE",
      notify: true,
    },
    {
      onSuccess: () => {
        router.push(
          courseChatbotSettingsRoute(assertNotNullOrUndefined(chatbotQuery.data?.course_id)),
        )
      },
    },
  )

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
          onConfigureChatbot={(newChatbot) => {
            configureChatbotMutation.mutate(newChatbot)
          }}
          onDeleteChatbot={(chatbotConfigurationId, chatbotName) => {
            if (window.confirm(t("delete-chatbot-confirmation", { name: chatbotName }))) {
              deleteChatbotMutation.mutate(chatbotConfigurationId)
            }
          }}
        />
      </div>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CustomizeChatbotPage))
