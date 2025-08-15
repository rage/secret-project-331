import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import ChatbotChatBox from "./ChatbotChatBox"

import { getDefaultChatbotConfigurationForCourse } from "@/services/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface ChatbotBlockProps {
  chatbotConfigurationId: string
  courseId: string
}

const ChatbotBlock: React.FC<BlockRendererProps<ChatbotBlockProps>> = ({ data }) => {
  const { t } = useTranslation()
  const chatbotConfigurationId = data.attributes.chatbotConfigurationId
  const courseId = data.attributes.courseId

  const defaultChatbotConfiguration = useQuery({
    queryKey: [`/chatbot/default-for-course/${courseId}`],
    queryFn: () => getDefaultChatbotConfigurationForCourse(assertNotNullOrUndefined(courseId)),
    enabled: courseId != null,
  })

  if (defaultChatbotConfiguration.isPending) {
    return <Spinner />
  }
  if (defaultChatbotConfiguration.isError) {
    return <ErrorBanner error={defaultChatbotConfiguration.error} />
  }

  if (chatbotConfigurationId === defaultChatbotConfiguration.data) {
    return <ErrorBanner variant={"readOnly"} error={t("error-default-chatbot-in-block")} />
  }

  return (
    <div
      className={css`
        display: block;
        height: 500px;

        ${respondToOrLarger.sm} {
          height: 900px;
        }
      `}
    >
      <ChatbotChatBox chatbotConfigurationId={chatbotConfigurationId} />
    </div>
  )
}

export default ChatbotBlock
