"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import CreateChatbotDialog from "./CreateChatbotDialog"

import { CourseManagementPagesProps } from "@/app/manage/courses/[id]/types"
import {
  getCourseChatbotsOptions,
  setCourseChatbotAsDefaultMutation,
  setCourseChatbotAsNonDefaultMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"
import { manageChatbotRoute } from "@/shared-module/common/utils/routes"
import { CardList, CardListItem } from "@/styles/styles"

const ChatBotPage: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const router = useRouter()

  const [createChatbotVisible, setCreateChatbotVisible] = useState(false)

  const getChatbotsList = useQuery(
    getCourseChatbotsOptions({
      path: {
        course_id: courseId,
      },
    }),
  )

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

  const setDefaultChatbotMutation = useToastMutationOptions(
    setCourseChatbotAsDefaultMutation(),
    {
      method: "POST",
      notify: true,
    },
    { onSuccess: () => getChatbotsList.refetch() },
  )

  const unsetDefaultChatbotMutation = useToastMutationOptions(
    setCourseChatbotAsNonDefaultMutation(),
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

  if (getChatbotsList.isLoading) {
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
                    setDefaultChatbotMutation.mutate({
                      path: {
                        chatbot_configuration_id: bot.id,
                        course_id: courseId,
                      },
                    })
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
                    unsetDefaultChatbotMutation.mutate({
                      path: {
                        chatbot_configuration_id: bot.id,
                        course_id: courseId,
                      },
                    })
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
