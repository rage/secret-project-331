import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/router"
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
const StyledLi = styled.li`
  margin: 0.5rem 0;
  padding: 1.5rem;
  background-color: ${baseTheme.colors.primary[100]};
  border: 1px solid ${baseTheme.colors.clear[300]};
  border-radius: 6px;
`

const ChatBotPage: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const router = useRouter()

  //const [customizeChatbotVisible, setCustomizeChatbotVisible] = useState(false)
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

  const closeDialog = (id: string) => {
    setCreateChatbotVisible(false)
    //setCustomizeChatbotVisible(true)
    /* eslint-disable i18next/no-literal-string */
    router.push(`/manage/chatbots/${id}`)
  }

  if (getChatbotsList.isError) {
    return <ErrorBanner variant={"readOnly"} error={getChatbotsList.error} />
  }

  if (getChatbotsList.isPending) {
    return <Spinner variant={"medium"} />
  }

  return (
    <>
      <div
        className={css`
          margin-bottom: 2.5rem;
          .heading {
            font-size: ${typography.h4};
            color: ${baseTheme.colors.gray[700]};
            font-family: ${headingFont};
            font-weight: bold;
          }
        `}
      >
        <h1 className="heading">{t("chatbots")}</h1>
        <Button
          size="medium"
          variant="secondary"
          onClick={() => {
            setCreateChatbotVisible(true)
          }}
        >
          {t("create-chatbot")}
        </Button>
      </div>
      <div>
        <h3>{t("customize-chatbot")}</h3>
        <StyledUl>
          {getChatbotsList.data?.map((bot) => (
            <StyledLi key={bot.id}>
              <h4
                className={css`
                  margin: 5px;
                `}
              >
                {bot.chatbot_name}
              </h4>
              <Link href={`/manage/chatbots/${bot.id}`} aria-label={`${t("customize-chatbot")}`}>
                <Button
                  size="medium"
                  variant="primary"
                  onClick={() => {
                    //setCustomizeChatbotVisible(true)
                  }}
                >
                  {t("edit")}
                </Button>
              </Link>
              <Button size="medium" variant="tertiary">
                {t("delete")}
              </Button>
            </StyledLi>
          ))}
        </StyledUl>
      </div>
      <CreateChatbotDialog
        courseId={courseId}
        getChatbotsList={getChatbotsList}
        open={createChatbotVisible}
        close={closeDialog}
      />
    </>
  )
}

export default ChatBotPage
