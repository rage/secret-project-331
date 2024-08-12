import { css } from "@emotion/css"
import { useMutation } from "@tanstack/react-query"
import { Account } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import { ChatbotDialogProps } from "./ChatbotDialog"

import { newChatbotConversation } from "@/services/backend"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"

const ChatbotDialogBody: React.FC<
  ChatbotDialogProps & { currentConversationInfo: ChatbotConversationInfo | undefined }
> = ({ setDialogOpen, currentConversationInfo, chatbotConfigurationId }) => {
  const { t } = useTranslation()

  const newConversationMutation = useMutation({
    mutationFn: () => newChatbotConversation(chatbotConfigurationId),
    onSuccess: () => {
      currentConversationInfoQuery.refetch()
    },
  })

  if (!currentConversationInfo) {
    // The chatbot is loading
    return <Spinner variant="medium" />
  }

  if (currentConversationInfo && !currentConversationInfo?.current_conversation) {
    // The chatbot has loaded, but no conversation is active. Show the warning message.
    return (
      <div
        className={css`
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;

          h1 {
            font-size: 24px;
            margin-bottom: 10px;
          }

          p {
            margin-bottom: 5px;
          }

          ul {
            margin-bottom: 10px;
            padding-left: 20px;
          }

          li {
            margin-bottom: 5px;
          }
        `}
      >
        <div
          className={css`
            flex-grow: 1;
          `}
        >
          <h1>About the chatbot</h1>

          <p>
            You are opening a chatbot based on a large language model (LLM). To use this chatbot,
            you must agree that you will...
          </p>

          <ul>
            <li>
              <b>Never disclose any sensitive information to the chatbot.</b>
            </li>
            <li>
              <b>Always check the claims made by the chatbot.</b> LLM-based chatbots can produce
              highly convincing but factually incorrect statements.
            </li>
            <li>
              <b>Always disclose use of LLMs in your studies.</b> You can find the University of
              Helsinki guidance on use of LLMs in studies{" "}
              <a href="https://studies.helsinki.fi/instructions/article/using-ai-support-learning">
                here
              </a>
              .{" "}
            </li>
          </ul>
        </div>

        <Button size="medium" variant="secondary">
          Agree
        </Button>
      </div>
    )
  }

  return (
    <div
      className={css`
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        padding: 20px;
      `}
    >
      <div
        className={css`
          flex-grow: 1;
        `}
      >
        {currentConversationInfo?.current_conversation_messages?.map((message) => (
          <div key={`chatbot-message-${message.id}`}>{message.message}</div>
        ))}
      </div>
      <div
        className={css`
          display: flex;
          gap: 10px;

          label {
            flex-grow: 1;
          }
        `}
      >
        <div
          className={css`
            flex-grow: 1;
          `}
        >
          <TextField label="Message" />
        </div>
        <Button variant="secondary" size="small">
          Send
        </Button>
      </div>
      <div>Warning: the bot may not tell the truth.</div>
    </div>
  )
}

export default ChatbotDialogBody
