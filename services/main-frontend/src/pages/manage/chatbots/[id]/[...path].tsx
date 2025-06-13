import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import React from "react"
import { useTranslation } from "react-i18next"

import MainFrontendBreadCrumbs from "@/components/MainFrontendBreadCrumbs"
import { getChatbotConfiguration } from "@/services/backend/courses/chatbots"
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
  const { id } = router.query

  const chatbotQuery = useQuery<ChatbotConfiguration>({
    queryKey: [`chatbot`, id],
    queryFn: () => getChatbotConfiguration(assertNotNullOrUndefined(id!.toString())),
    enabled: !!id,
  })

  if (chatbotQuery.isLoading) {
    return <Spinner variant="medium" />
  }
  if (chatbotQuery.isError) {
    return <ErrorBanner variant="readOnly" error={chatbotQuery.error} />
  }
  let chatbot = null
  if (chatbotQuery.data === undefined) {
    // eslint-disable-next-line i18next/no-literal-string
    return <ErrorBanner variant="readOnly" error={"chatbot not found"} />
  } else {
    chatbot = chatbotQuery.data
  }

  return (
    <>
      <MainFrontendBreadCrumbs organizationSlug={null} courseId={chatbot.course_id} />
      <h1>{chatbot.chatbot_name}</h1>
      <Button
        size="medium"
        variant="secondary"
        onClick={() => {
          router.back() //works?
        }}
      >
        {t("button-text-cancel")}
      </Button>
    </>
  )
}

export default withErrorBoundary(withSignedIn(CustomizeChatbotPage))
