import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { CardList, CardListItem } from "../../../../styles/styles"

import CreateChatbotDialog from "./CreateChatbotDialog"

import { CourseManagementPagesProps } from "@/pages/manage/courses/[id]/[...path]"
import {
  getCourseChatbots,
  setAsDefaultChatbot,
  setAsNonDefaultChatbot,
} from "@/services/backend/courses/chatbots"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { manageChatbotRoute } from "@/shared-module/common/utils/routes"

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
      await setAsDefaultChatbot(assertNotNullOrUndefined(courseId), chatbotConfigurationId),
    {
      method: "POST",
      notify: true,
    },
    { onSuccess: () => getChatbotsList.refetch() },
  )

  const unsetDefaultChatbotMutation = useToastMutation(
    async (chatbotConfigurationId: string) =>
      await setAsNonDefaultChatbot(assertNotNullOrUndefined(courseId), chatbotConfigurationId),
    {
      method: "POST",
      notify: true,
    },
    { onSuccess: () => getChatbotsList.refetch() },
  )

  const closeDialogOpenEdit = (id: string) => {
    setCreateChatbotVisible(false)
    router.push(manageChatbotRoute(id))
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
        <h2>{t("customize-chatbot")}</h2>
        <CardList>
          {sortedChatbotsList.map((bot) => (
            <CardListItem key={bot.id}>
              <h3
                className={css`
                  margin: 5px;
                `}
              >
                {bot.chatbot_name} <em>{bot.default_chatbot ? `(${t("label-default")})` : ""}</em>
              </h3>
              <Button
                size="medium"
                variant="primary"
                onClick={() => router.push(manageChatbotRoute(bot.id))}
              >
                {t("edit")}
              </Button>
              {!bot.default_chatbot ? (
                <Button
                  size="medium"
                  variant="secondary"
                  onClick={() => {
                    setDefaultChatbotMutation.mutate(bot.id)
                  }}
                  disabled={setDefaultChatbotMutation.isPending}
                >
                  {t("set-default-chatbot")}
                </Button>
              ) : (
                <Button
                  size="medium"
                  variant="secondary"
                  onClick={() => {
                    unsetDefaultChatbotMutation.mutate(bot.id)
                  }}
                  disabled={unsetDefaultChatbotMutation.isPending}
                >
                  {t("unset-default-chatbot")}
                </Button>
              )}
            </CardListItem>
          ))}
        </CardList>
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
