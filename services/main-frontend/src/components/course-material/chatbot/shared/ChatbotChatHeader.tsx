"use client"

import { css } from "@emotion/css"
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import {
  Account,
  AddMessage,
  ArrowDownToBracket,
  DotsHorizontal,
} from "@vectopus/atlas-icons-react"
import React from "react"
import { Button, Heading } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { DiscrChatbotDialogProps } from "../Chatbot/ChatbotChat"

import DropdownMenu, { OurMenuItem } from "@/components/Topbar/DropdownMenu"
import { ChatbotConversation, ChatbotConversationInfo } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"
import { createChatbotTranscript } from "@/utils/course-material/createChatbotTranscript"
import { downloadStringAsFile } from "@/utils/course-material/downloadStringAsFile"

type ChatbotChatHeaderProps = {
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
  newConversation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
} & DiscrChatbotDialogProps

const headerContainerStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background-color: ${baseTheme.colors.green[300]};
  border-radius: 10px 10px 0px 0px;
`

const iconStyle = css`
  background-color: ${baseTheme.colors.green[100]};
  color: ${baseTheme.colors.green[400]};
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
  color: ${baseTheme.colors.green[700]};
  transition: filter 0.2s;

  &:hover {
    filter: brightness(0.7) contrast(1.1);
  }
`

const buttonsWrapper = css`
  display: flex;
  align-items: flex-start;
`

const downloadTranscript = (info: ChatbotConversationInfo | undefined, filename: string) => {
  if (info === undefined) {
    return
  }
  let transcript = createChatbotTranscript(info)
  // eslint-disable-next-line i18next/no-literal-string
  downloadStringAsFile(transcript, "txt", filename)
}

const ChatbotChatHeader: React.FC<ChatbotChatHeaderProps> = (props) => {
  const { t } = useTranslation()
  const { currentConversationInfo, newConversation, isCourseMaterialBlock } = props

  const createTranscript = useToastMutation(
    async () => {
      let info = currentConversationInfo.data
      downloadTranscript(info, `${t("conversation-with", { name: info?.chatbot_name })}`)
    },
    {
      notify: true,
      method: "POST",
      successMessage: t("transcript-downloaded-successfully"),
    },
  )

  let items: OurMenuItem[] = [
    {
      // eslint-disable-next-line i18next/no-literal-string
      id: "chatbot-header-menu-new-conversation-button",
      onAction: () => {
        if (!newConversation.isPending) {
          newConversation.mutate()
        }
      },
      icon: (
        <AddMessage
          className={css`
            color: ${baseTheme.colors.green[700]};
            position: relative;
            top: -0.25rem;
          `}
        />
      ),
      type: "action",
      label: t("new-conversation"),
    },
  ]

  if (currentConversationInfo.data?.current_conversation !== null) {
    items.push({
      // eslint-disable-next-line i18next/no-literal-string
      id: "chatbot-header-menu-dl-transcript-button",
      onAction: createTranscript.mutate,
      icon: (
        <ArrowDownToBracket
          className={css`
            color: ${baseTheme.colors.green[700]};
            position: relative;
            top: -0.25rem;
          `}
        />
      ),
      type: "action",
      label: t("download-transcript"),
    })
  }

  if (currentConversationInfo.isLoading) {
    return <Spinner variant="medium" />
  }

  if (currentConversationInfo.isError) {
    return (
      <div
        className={css`
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
        `}
      >
        <ErrorBanner error={currentConversationInfo.error} variant="readOnly" />
      </div>
    )
  }

  return (
    <div className={headerContainerStyle}>
      <div className={iconStyle}>
        <Account />
      </div>
      <Heading
        id={isCourseMaterialBlock ? undefined : props.chatbotTitleId}
        slot="title"
        className={titleStyle}
      >
        {currentConversationInfo.data?.chatbot_name}
      </Heading>
      <div className={buttonsWrapper}>
        <DropdownMenu
          controlButton={
            //<Hamburger isActive={true} buttonWidth={20} />
            <Button className={buttonStyle}>
              <DotsHorizontal
                className={css`
                  position: relative;
                  top: 0.25rem;
                `}
              />
            </Button>
          }
          navLabel={null}
          // eslint-disable-next-line i18next/no-literal-string
          menuTestId="chatbot-header-menu"
          items={items}
        ></DropdownMenu>
        {!isCourseMaterialBlock && (
          <Button
            slot="close"
            className={buttonStyle}
            aria-label={t("close")}
            onPress={props.closeChatbot}
          >
            <DownIcon />
          </Button>
        )}
      </div>
    </div>
  )
}

export default React.memo(ChatbotChatHeader)
