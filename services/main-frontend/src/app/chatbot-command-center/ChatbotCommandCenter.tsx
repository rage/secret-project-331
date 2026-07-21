"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import { getAllCoursesOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Select } from "@/shared-module/components"

interface Props {
  chatbots: ChatbotConfiguration[]
}

const ChatbotCommandCenter = ({ chatbots }: Props) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<ChatbotConfiguration>({})
  const configuration_id = watch("id")

  const courseQuery = useQuery({
    ...getAllCoursesOptions(),
  })

  const chatbotsCoursesMerged = chatbots.map((chatbot) => {
    const matched = courseQuery.data?.find((course) => course.id === chatbot.course_id)
    return {
      ...chatbot,
      course_name: matched !== undefined ? matched.name : "",
    }
  })

  const chatbotOptions = useMemo(() => {
    const grouped = chatbotsCoursesMerged.reduce(
      (acc, chatbot) => {
        if (!acc[chatbot.course_name]) {
          acc[chatbot.course_name] = []
        }
        acc[chatbot.course_name]?.push({
          label: chatbot.chatbot_name,
          value: chatbot.id,
        })
        return acc
      },
      {} as Record<string, { label: string; value: string }[]>,
    )

    return Object.entries(grouped).map(([course, options]) => ({
      label: course,
      options,
    }))
  }, [chatbotsCoursesMerged])

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
