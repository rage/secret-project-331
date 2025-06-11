import { css } from "@emotion/css"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import ChatbotConfigurationForm from "./ChatbotConfigurationForm"
import CreateChatbotDialog from "./CreateChatbotDialog"

import { CourseManagementPagesProps } from "@/pages/manage/courses/[id]/[...path]"
import Button from "@/shared-module/common/components/Button"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"

const ChatBotPage: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()

  const [customizeChatbotVisible, setCustomizeChatbotVisible] = useState(false)
  const [createChatbotVisible, setCreateChatbotVisible] = useState(false)

  /*   const getChatbotsList = useQuery({
    queryKey: ["organization-exams", organizationId],
    queryFn: () => {
      if (organizationId) {
        return fetchOrganizationExams(organizationId)
      } else {
        return Promise.reject(new Error("Organization ID undefined"))
      }
    },
    enabled: !!organizationId,
  }) */

  if (customizeChatbotVisible) {
    return (
      <>
        <ChatbotConfigurationForm
          closeEditor={() => {
            setCustomizeChatbotVisible(false)
          }}
        />
      </>
    )
  }

  return (
    <>
      <h1
        className={css`
          font-size: ${typography.h4};
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("chatbot")}
      </h1>

      <Button
        size="medium"
        variant="secondary"
        onClick={() => {
          setCreateChatbotVisible(true)
        }}
      >
        {t("create-chatbot")}
      </Button>
      <CreateChatbotDialog
        courseId={courseId}
        open={createChatbotVisible}
        close={() => setCreateChatbotVisible(false)}
      />
      <Button
        size="medium"
        variant="secondary"
        onClick={() => {
          setCustomizeChatbotVisible(true)
        }}
      >
        {t("customize-chatbot")}
      </Button>
    </>
  )
}

export default ChatBotPage
