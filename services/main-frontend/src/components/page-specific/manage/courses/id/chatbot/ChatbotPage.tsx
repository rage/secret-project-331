import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import ChatbotConfigurationForm from "./ChatbotConfigurationForm"
import CreateChatbotDialog from "./CreateChatbotDialog"

import { CourseManagementPagesProps } from "@/pages/manage/courses/[id]/[...path]"
import { getCourseChatbots } from "@/services/backend/courses/chatbots"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"

// copypasted from ExamList, maybe refactor
const StyledUl = styled.ul`
  margin: 1rem 0;
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-radius: 8px;
`

const ChatBotPage: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()

  const [customizeChatbotVisible, setCustomizeChatbotVisible] = useState(false)
  const [createChatbotVisible, setCreateChatbotVisible] = useState(false)

  const getChatbotsList = useQuery({
    queryKey: ["course-chatbots", courseId],
    queryFn: () => {
      if (courseId) {
        return getCourseChatbots(courseId)
      } else {
        return Promise.reject(new Error("Course ID undefined"))
      }
    },
    enabled: !!courseId,
  })

  if (getChatbotsList.isError) {
    return <ErrorBanner variant={"readOnly"} error={getChatbotsList.error} />
  }

  if (getChatbotsList.isPending) {
    return <Spinner variant={"medium"} />
  }

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
        {t("chatbots")}
      </h1>
      <StyledUl>
        {getChatbotsList.data?.map((bot) => <li key={bot.id}>{bot.chatbot_name}</li>)}
      </StyledUl>

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
        getChatbotsList={getChatbotsList}
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
