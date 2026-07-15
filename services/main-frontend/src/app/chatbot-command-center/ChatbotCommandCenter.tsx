"use client"

import { css } from "@emotion/css"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import { Select } from "@/shared-module/components"

interface ChatbotCommandCenterData {
  configuration_id: string
  chatbot_name: string
  course_name: string
}

interface Props {
  chatbotData: ChatbotCommandCenterData[]
}

const ChatbotCommandCenter = ({ chatbotData }: Props) => {
  const { t } = useTranslation()
  const firstChatbot = chatbotData[0]
  const { control, watch } = useForm<ChatbotCommandCenterData>({
    defaultValues: {
      configuration_id: firstChatbot.configuration_id,
      chatbot_name: firstChatbot.chatbot_name,
      course_name: firstChatbot.course_name,
    },
  })

  const configuration_id = watch("configuration_id")
  const distinctCourses = [...new Set(chatbotData.map((data) => data.course_name))]
  return (
    <div>
      <form>
        <Select
          id={"chatbot-select"}
          control={control}
          name={"configuration_id"}
          label={t("select-chatbot")}
          options={distinctCourses.map((course) => {
            return {
              label: course,
              options: chatbotData
                .filter((data) => data.course_name === course)
                .map((dataFiltered) => {
                  return {
                    label: `${dataFiltered.chatbot_name}`,
                    value: dataFiltered.configuration_id,
                  }
                }),
            }
          })}
          searchEnabled={true}
          searchPlaceholder={t("chatbot-search-placeholder")}
          className={css`
            margin-bottom: 1rem;
          `}
        />
      </form>

      <div
        className={css`
          height: 75vh;
        `}
      >
        <ChatbotChat chatbotConfigurationId={configuration_id} isCourseMaterialBlock={true} />
      </div>
    </div>
  )
}

export default ChatbotCommandCenter
