"use client"

import { css } from "@emotion/css"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import type { ChatbotCommandCenterData } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Select } from "@/shared-module/components"

interface Props {
  chatbots: ChatbotCommandCenterData[]
}

const ChatbotCommandCenter = ({ chatbots }: Props) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<ChatbotCommandCenterData>({})
  const configuration_id = watch("configuration_id")

  const chatbotOptions = useMemo(() => {
    const grouped = chatbots.reduce(
      (acc, chatbot) => {
        if (!acc[chatbot.course_name]) {
          acc[chatbot.course_name] = []
        }
        acc[chatbot.course_name]?.push({
          label: chatbot.chatbot_name,
          value: chatbot.configuration_id,
        })
        return acc
      },
      {} as Record<string, { label: string; value: string }[]>,
    )

    return Object.entries(grouped).map(([course, options]) => ({
      label: course,
      options,
    }))
  }, [chatbots])

  return (
    <div>
      <form>
        <Select
          id={"chatbot-select"}
          control={control}
          name={"configuration_id"}
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
