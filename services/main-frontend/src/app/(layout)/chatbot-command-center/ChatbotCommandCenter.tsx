"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import ConversationIdContext from "@/contexts/course-material/ConversationIdContext"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import { getCurrentConversationIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Select } from "@/shared-module/components"

import SideBar from "./SideBar"

interface ChatbotCommandCenterProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
}

const ChatbotCommandCenter = ({ chatbots, courses }: ChatbotCommandCenterProps) => {
  const { t } = useTranslation()
  const { control, watch, setValue } = useForm<ChatbotConfiguration>({})
  const configuration_id = watch("id")
  const [conversationId, setConversationId] = useState<null | string>(null)
  const currentConversationIdQuery = useQuery(
    getCurrentConversationIdOptions({
      path: {
        chatbot_configuration_id: configuration_id,
      },
    }),
  )

  const sideBarContainer = css`
    border-radius: 10px;
    box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
    margin: 0;
    padding: 0;
    margin-top: 1rem;
    padding-top: 1rem;
    max-height: 87vh;
    overflow-y: auto;
  `

  const chatbotOptions = useMemo(() => {
    const grouped = Object.values(
      chatbots.reduce(
        (acc, chatbot) => {
          const matched = courses.find((course) => course.id === chatbot.course_id)
          const courseName =
            matched !== undefined ? matched.name : t("select-chatbot-globals-title")

          // oxlint-disable-next-line i18next/no-literal-string
          const groupId = chatbot.course_id ?? "globals"

          if (!acc[groupId]) {
            acc[groupId] = {
              label: courseName,
              courseId: chatbot.course_id,
              options: [],
            }
          }
          acc[groupId].options.push({
            label: chatbot.chatbot_name,
            value: chatbot.id,
          })

          return acc
        },
        {} as Record<
          string,
          {
            label: string
            courseId: string | null | undefined
            options: { label: string; value: string }[]
          }
        >,
      ),
    )

    const groupedSorted = grouped.toSorted((a, b) => {
      if (!a.courseId && b.courseId) {
        return -1
      }
      if (a.courseId && !b.courseId) {
        return 1
      }
      return a.label.localeCompare(b.label)
    })

    return groupedSorted
  }, [chatbots, courses, t])
  // Prevents chatbot disclaimer from showing up
  // when chatbot is changed
  useEffect(() => {
    setConversationId(null)
  }, [configuration_id])

  const chatbotStateAndData = useChatbotStateAndData(
    configuration_id,
    undefined,
    conversationId ?? currentConversationIdQuery.data,
    setConversationId,
  )

  return (
    <div
      className={css`
        display: grid;
        grid-template-columns: 1fr 4fr;
        margin: 0 1rem;
        gap: 0.5rem;
      `}
    >
      <div className={sideBarContainer}>
        {configuration_id && (
          <SideBar
            newConversationMutation={chatbotStateAndData.newConversationMutation}
            setConversationId={setConversationId}
            setValue={setValue}
          />
        )}
      </div>
      <div>
        <h1>{t("link-text-chatbot-command-center")}</h1>
        <form>
          <Select
            id={"chatbot-select"}
            control={control}
            name={"id"}
            label={t("select-chatbot")}
            options={chatbotOptions}
            searchEnabled={true}
            searchPlaceholder={t("chatbot-search-placeholder")}
          />
        </form>
        <div
          className={css`
            margin-top: 0.5rem;
            height: 75vh;
          `}
        >
          {configuration_id === undefined ? (
            <div
              className={css`
                display: flex;
                justify-content: center;
                align-items: center;
                height: 75vh;
                border-radius: 10px;
                box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
              `}
            ></div>
          ) : (
            <ConversationIdContext.Provider value={setConversationId}>
              <ChatbotChatBox {...chatbotStateAndData} />
            </ConversationIdContext.Provider>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatbotCommandCenter
