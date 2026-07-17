"use client"

import { css } from "@emotion/css"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import { baseTheme } from "@/shared-module/common/styles"
import { Select } from "@/shared-module/components"

interface ChatbotCommandCenterData {
  configuration_id: string
  chatbot_name: string
  course_name: string
}

interface Props {
  chatbots: ChatbotCommandCenterData[]
}

const ChatbotCommandCenter = ({ chatbots }: Props) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<ChatbotCommandCenterData>({})
  const configuration_id = watch("configuration_id")
  function groupChatbotsByCourse() {
    const distinctCourses = [...new Set(chatbots.map((chatbot) => chatbot.course_name))]

    return distinctCourses.map((course) => {
      return {
        label: course,
        options: chatbots
          .filter((chatbot) => chatbot.course_name === course)
          .map((chatbot) => {
            return {
              label: `${chatbot.chatbot_name}`,
              value: chatbot.configuration_id,
            }
          }),
      }
    })
  }

  return (
    <div>
      <form>
        <Select
          id={"chatbot-select"}
          control={control}
          name={"configuration_id"}
          label={t("select-chatbot")}
          options={groupChatbotsByCourse()}
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
