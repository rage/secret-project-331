import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { Account, AddMessage } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import { ChatbotDialogProps } from "./ChatbotDialog"

import { newChatbotConversation } from "@/services/backend"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"

const ChatbotDialogHeader: React.FC<
  ChatbotDialogProps & { currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error> }
> = ({ setDialogOpen, currentConversationInfo, chatbotConfigurationId }) => {
  const { t } = useTranslation()

  const newConversationMutation = useToastMutation(
    () => newChatbotConversation(chatbotConfigurationId),
    { notify: false },
    {
      onSuccess: () => {
        currentConversationInfo.refetch()
      },
    },
  )

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        background-color: ${baseTheme.colors.gray[100]};
        border-radius: 10px 10px 0px 0px;
      `}
    >
      <div
        className={css`
          background-color: ${baseTheme.colors.clear[200]};
          color: ${baseTheme.colors.gray[400]};
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0.5rem;
          border-radius: 50%;
          margin-right: 1rem;
        `}
      >
        <Account />
      </div>
      <h1
        className={css`
          font-style: normal;
          font-weight: 500;
          font-size: 22px;
          line-height: 130%;
        `}
      >
        {currentConversationInfo.data?.chatbot_name}
      </h1>
      <button
        onClick={() => newConversationMutation.mutate()}
        disabled={newConversationMutation.isPending}
        className={css`
          font-size: 20px;
          cursor: pointer;
          background-color: transparent;
          border-radius: 50%;
          border: none;
          margin: 0 0.5rem;
          color: ${baseTheme.colors.gray[400]};

          transition: filter 0.2s;

          &:hover {
            filter: brightness(0.7) contrast(1.1);
          }
        `}
      >
        <AddMessage />
      </button>
      <button
        onClick={() => setDialogOpen(false)}
        className={css`
          font-size: 20px;
          cursor: pointer;
          background-color: transparent;
          border-radius: 50%;
          border: none;
          color: ${baseTheme.colors.gray[400]};

          position: relative;
          top: -3px;

          transition: filter 0.2s;

          &:hover {
            filter: brightness(0.7) contrast(1.1);
          }
        `}
        aria-label={t("close")}
      >
        <DownIcon />
      </button>
    </div>
  )
}

export default ChatbotDialogHeader
