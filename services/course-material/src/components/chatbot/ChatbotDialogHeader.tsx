import { css, cx } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { Account, AddMessage } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { ChatbotDialogProps } from "./ChatbotDialog"

import { newChatbotConversation } from "@/services/backend"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"

interface ChatbotDialogHeaderProps extends ChatbotDialogProps {
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
}

const headerContainerStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background-color: ${baseTheme.colors.gray[100]};
  border-radius: 10px 10px 0px 0px;
`

// eslint-disable-next-line i18next/no-literal-string
const iconStyle = css`
  background-color: ${baseTheme.colors.clear[200]};
  color: ${baseTheme.colors.gray[400]};
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
  border-radius: 50%;
  margin-right: 1rem;
`

const titleStyle = css`
  font-style: normal;
  font-weight: 500;
  font-size: 22px;
  line-height: 130%;
`

const buttonStyle = css`
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
`

const buttonsWrapper = css`
  display: flex;
`

const ChatbotDialogHeader: React.FC<ChatbotDialogHeaderProps> = ({
  setDialogOpen,
  currentConversationInfo,
  chatbotConfigurationId,
}) => {
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
    <div className={headerContainerStyle}>
      <div className={iconStyle}>
        <Account />
      </div>
      <h1 className={titleStyle}>{currentConversationInfo.data?.chatbot_name}</h1>
      <div className={buttonsWrapper}>
        <button
          onClick={() => newConversationMutation.mutate()}
          disabled={newConversationMutation.isPending}
          className={buttonStyle}
          aria-label={t("new-conversation")}
        >
          <AddMessage />
        </button>
        <button
          onClick={() => setDialogOpen(false)}
          className={cx(
            buttonStyle,
            css`
              position: relative;
              top: -3px;
            `,
          )}
          aria-label={t("close")}
        >
          <DownIcon />
        </button>
      </div>
    </div>
  )
}

export default React.memo(ChatbotDialogHeader)
