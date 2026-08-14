"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { createContext, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import {
  allUserConversationsOptions,
  getCurrentConversationIdOptions,
} from "@/generated/course-material-api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { QueryResult, Select } from "@/shared-module/components"

import SideBar from "./SideBar"

interface ChatbotCommandCenterProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
}

const ChatbotCommandCenter = ({ chatbots, courses }: ChatbotCommandCenterProps) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<ChatbotConfiguration>({})
  const configuration_id = watch("id")
  const [selectedConversationId, setSelectedConversationId] = useState<null | string>(null)

  const currentConversationIdQuery = useQuery(
    getCurrentConversationIdOptions({
      path: {
        chatbot_configuration_id: configuration_id,
      },
    }),
  )

  const conversationsQuery = useQuery(
    allUserConversationsOptions({
      path: {
        chatbot_configuration_id: configuration_id,
      },
    }),
  )

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

  return (
    <div
      className={css`
        display: grid;
        grid-template-columns: 1fr 4fr;
        margin: 0 1rem;
        gap: 0.5rem;
      `}
    >
      {configuration_id === undefined ? (
        <div
          className={css`
            border-radius: 10px;
            box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
            height: 75vh;
            margin: 0;
            padding: 0;
            height: 100%;
          `}
        ></div>
      ) : (
        <div
          className={css`
            border-radius: 10px;
            box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
            height: 75vh;
            margin: 0;
            padding: 0;
            padding: 0.5rem;
            margin-top: 4rem;
            overflow-y: auto;
          `}
        >
          <QueryResult query={conversationsQuery}>
            {(conversations) => (
              <SideBar
                conversations={conversations}
                setSelectedConversationId={setSelectedConversationId}
              />
            )}
          </QueryResult>
        </div>
      )}

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
            <QueryResult query={currentConversationIdQuery}>
              {(conversationId) => (
                <ChatbotChat
                  conversationId={conversationId ?? selectedConversationId}
                  chatbotConfigurationId={configuration_id}
                  isCourseMaterialBlock={true}
                />
              )}
            </QueryResult>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatbotCommandCenter
