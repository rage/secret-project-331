"use client"

import { css } from "@emotion/css"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Select } from "@/shared-module/components"

interface ChatbotCommandCenterProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
}

const ChatbotCommandCenter = ({ chatbots, courses }: ChatbotCommandCenterProps) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<ChatbotConfiguration>({})
  const configuration_id = watch("id")

  const chatbotOptions = useMemo(() => {
    const grouped = chatbots.reduce(
      (acc, chatbot) => {
        const matched = courses.find((course) => course.id === chatbot.course_id)
        const courseName = matched !== undefined ? matched.name : t("select-chatbot-globals-title")
        if (!acc[courseName]) {
          acc[courseName] = []
        }
        acc[courseName]?.push({
          isGlobalChatbot: matched === undefined,
          label: chatbot.chatbot_name,
          value: chatbot.id,
        })
        return acc
      },
      {} as Record<string, { isGlobalChatbot: boolean; label: string; value: string }[]>,
    )
    const groupedSorted = Object.fromEntries(
      Object.entries(grouped).toSorted(([aKey, aValue], [bKey, bValue]) => {
        const aIsGlobal = aValue.some((value) => value.isGlobalChatbot)
        const bIsGlobal = bValue.some((value) => value.isGlobalChatbot)
        if (aIsGlobal !== bIsGlobal) {
          return aIsGlobal ? -1 : 1
        }
        return aKey.localeCompare(bKey)
      }),
    )
    return Object.entries(groupedSorted).map(([group, options]) => ({
      label: group,
      options,
    }))
  }, [chatbots, courses, t])

  return (
    <div>
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
          margin-top: 1rem;
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
          <ChatbotChat chatbotConfigurationId={configuration_id} isCourseMaterialBlock={true} />
        )}
      </div>
    </div>
  )
}

export default ChatbotCommandCenter
