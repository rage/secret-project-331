import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."

import ChatbotChatBox from "./ChatbotChatBox"

//import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface ChatbotBlockProps {
  chatbotConfigurationId: string
}

const ChatbotBlock: React.FC<BlockRendererProps<ChatbotBlockProps>> = ({ data }) => {
  const chatbotConfigurationId = data.attributes.chatbotConfigurationId

  return (
    <div>
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
    </div>
  )
}

export default ChatbotBlock
