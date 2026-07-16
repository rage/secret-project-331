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
  chatbotData: ChatbotCommandCenterData[]
}

const ChatbotCommandCenter = ({ chatbotData }: Props) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<ChatbotCommandCenterData>({})
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
