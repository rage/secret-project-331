import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import CreateChatbotDialog from "./CreateChatbotDialog"

import { CourseManagementPagesProps } from "@/pages/manage/courses/[id]/[...path]"
import { getCourseChatbots, setAsDefaultChatbot } from "@/services/backend/courses/chatbots"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

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

  const [createChatbotVisible, setCreateChatbotVisible] = useState(false)

  const getChatbotsList = useQuery({
    queryKey: ["course-chatbots", courseId],
    queryFn: () => getCourseChatbots(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })

  const sortedChatbotsList = useMemo(() => {
    return [...(getChatbotsList.data ?? [])].sort((a, b) => {
      if (a.default_chatbot) {
        return -1
      }
      if (b.default_chatbot) {
        return 1
      }
      return a.chatbot_name.localeCompare(b.chatbot_name)
    })
  }, [getChatbotsList.data])

  const setDefaultChatbotMutation = useToastMutation(
    async (chatbotConfigurationId: string) =>
      await setAsDefaultChatbot(courseId, chatbotConfigurationId),
    {
      method: "POST",
      notify: true,
      successMessage: t("default-toast-success-message"),
    },
    { onSuccess: () => getChatbotsList.refetch() },
  )

  const closeDialogOpenEdit = (id: string) => {
    setCreateChatbotVisible(false)
    /* eslint-disable i18next/no-literal-string */
    router.push(`/manage/chatbots/${id}`)
  }
  const closeDialog = () => {
    setCreateChatbotVisible(false)
  }

  if (getChatbotsList.isError) {
    return <ErrorBanner variant={"readOnly"} error={getChatbotsList.error} />
  }

  if (getChatbotsList.isPending) {
    return <Spinner variant={"medium"} />
  }
  // use memo for sorting to sort once
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
          {sortedChatbotsList.map((bot) => (
            <StyledLi key={bot.id}>
              <h4
                className={css`
                  margin: 5px;
                `}
              >
                {bot.chatbot_name} <em>{bot.default_chatbot ? `(${t("label-default")})` : ""}</em>
              </h4>
              <Link href={`/manage/chatbots/${bot.id}`} aria-label={`${t("customize-chatbot")}`}>
                <Button size="medium" variant="primary">
                  {t("edit")}
                </Button>
              </Link>
              {!bot.default_chatbot && (
                <Button
                  size="medium"
                  variant="secondary"
                  onClick={() => {
                    setDefaultChatbotMutation.mutate(bot.id)
                  }}
                >
                  {t("set-as-default-chatbot")}
                </Button>
              )}
            </StyledLi>
          ))}
        </StyledUl>
      </div>
      <CreateChatbotDialog
        courseId={courseId}
        getChatbotsList={getChatbotsList}
        open={createChatbotVisible}
        close={closeDialog}
        closeEdit={closeDialogOpenEdit}
      />
    </>
  )
}

export default ChatBotPage
