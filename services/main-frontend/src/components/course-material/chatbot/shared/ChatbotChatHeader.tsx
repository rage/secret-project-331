"use client"

import { css } from "@emotion/css"
import { Account, AddMessage, ArrowDownToBracket, Pencil } from "@vectopus/atlas-icons-react"
import { useRouter } from "next/navigation"
import type { DOMAttributes } from "react"
import React from "react"
import { Button, Heading } from "react-aria-components"
import { useTranslation } from "react-i18next"

import type { DropdownMenuItem } from "@/components/DropdownMenu"
import DropdownMenu from "@/components/DropdownMenu"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"
import { manageChatbotRoute } from "@/shared-module/common/utils/routes"
import { removeSavedChatbotAnonymousToken } from "@/utils/anonymousTokenLocalStorage"
import { createChatbotTranscript } from "@/utils/course-material/createChatbotTranscript"
import { downloadStringAsFile } from "@/utils/course-material/downloadStringAsFile"

import ClarificationTooltip from "../../../ClarificationTooltip"
import { useChatbotContext } from "./ChatbotContext"

interface ChatbotDialogHeaderProps {
  isAlwaysOpen: false
  closeChatbot: () => void
  titleProps: DOMAttributes<Element>
}

interface ChatbotNoDialogHeaderProps {
  isAlwaysOpen: true
}

type ChatbotChatHeaderProps = ChatbotDialogHeaderProps | ChatbotNoDialogHeaderProps

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
  border-radius: 50%;
  border: none;
  color: ${baseTheme.colors.green[700]};
  background-color: ${baseTheme.colors.green[300]};
  box-shadow: none;
  padding: 6px 14px;

  &:hover,
  &[data-hovered] {
    background: ${baseTheme.colors.green[400]};
    border-color: ${baseTheme.colors.green[400]};
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }
  &[data-pressed] {
    background: ${baseTheme.colors.green[500]};
    border-color: ${baseTheme.colors.green[500]};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }
`

const buttonsWrapper = css`
  display: flex;
  align-items: baseline;
`

const ChatbotChatHeader: React.FC<ChatbotChatHeaderProps> = (props) => {
  const { t } = useTranslation()
  const { isAlwaysOpen } = props

  const { currentConversationInfo, newConversationMutation } = useChatbotContext()

  const router = useRouter()
  const createTranscript = useToastMutation(
    // oxlint-disable-next-line require-await -- async for the mutation Promise contract
    async () => {
      let info = currentConversationInfo.data
      if (info === undefined) {
        throw new Error("No current conversation data")
      }
      let transcript = createChatbotTranscript(info)
      downloadStringAsFile(
        transcript,
        // oxlint-disable-next-line i18next/no-literal-string
        "txt",
        `${t("conversation-with", { name: info?.chatbot_name })}`,
      )
    },
    {
      notify: true,
      method: "POST",
      successMessage: t("transcript-downloaded-successfully"),
    },
  )

  let items: DropdownMenuItem[] = [
    {
      // oxlint-disable-next-line i18next/no-literal-string
      id: "chatbot-header-menu-new-conversation-button",
      onAction: () => {
        if (!newConversationMutation.isPending) {
          newConversationMutation.mutate()
          removeSavedChatbotAnonymousToken()
        }
      },
      disabled: newConversationMutation.isPending,
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

  if (currentConversationInfo.data?.current_conversation) {
    items.push({
      // oxlint-disable-next-line i18next/no-literal-string
      id: "chatbot-header-menu-dl-transcript-button",
      onAction: createTranscript.mutate,
      disabled: createTranscript.isPending,
      icon: (
        <ArrowDownToBracket
          className={css`
            color: ${baseTheme.colors.green[700]};
            position: relative;
            height: 22px;
            width: 22px;
            top: -0.275rem;
          `}
        />
      ),
      type: "action",
      label: t("download-transcript"),
    })
  }

  const chatbotConversationInfo = currentConversationInfo.data?.current_conversation

  const permissionCheck = useAuthorizeMultiple(
    chatbotConversationInfo?.course_id
      ? [
          {
            action: { type: "teach" },
            resource: { type: "course", id: chatbotConversationInfo.course_id },
          },
        ]
      : [
          {
            action: { type: "edit" },
            resource: { type: "global_permissions" },
          },
        ],
  )

  const hasPermission = permissionCheck.isSuccess && permissionCheck.data?.some(Boolean)

  if (hasPermission && chatbotConversationInfo) {
    items.push({
      // oxlint-disable-next-line i18next/no-literal-string
      id: "chatbot-header-menu-edit-chatbot-button",
      onAction: () => {
        router.push(manageChatbotRoute(chatbotConversationInfo.chatbot_configuration_id))
      },
      icon: (
        <Pencil
          className={css`
            color: ${baseTheme.colors.green[700]};
            position: relative;
            height: 22px;
            width: 22px;
            top: -0.275rem;
          `}
        />
      ),
      type: "action",

      label: t("edit-chatbot"),
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
        <ErrorBanner
          error={currentConversationInfo.error}
          variant="readOnly"
          maxHeightVH={50}
          listMaxHeightVH={35}
        />
      </div>
    )
  }

  return (
    <div className={headerContainerStyle}>
      <div className={iconStyle}>
        <Account />
      </div>
      <Heading slot="title" className={titleStyle} {...(isAlwaysOpen ? {} : props.titleProps)}>
        {currentConversationInfo.data?.chatbot_name}
      </Heading>
      <div className={buttonsWrapper}>
        <DropdownMenu
          // oxlint-disable-next-line i18next/no-literal-string
          menuTestId="chatbot-header-menu"
          // oxlint-disable-next-line i18next/no-literal-string
          menuButtonTestId="chatbot-header-menu-button"
          controlButtonClassName={buttonStyle}
          controlButtonIconColor={`${baseTheme.colors.green[700]}`}
          controlButtonAriaLabel={t("label-actions")}
          controlButtonTooltipText={t("label-actions")}
          controlButtonIconWidth={24}
          items={items}
        />
        {!isAlwaysOpen && (
          <ClarificationTooltip text={t("close")}>
            <Button
              slot="close"
              className={buttonStyle}
              aria-label={t("close")}
              onPress={props.closeChatbot}
            >
              <DownIcon />
            </Button>
          </ClarificationTooltip>
        )}
      </div>
    </div>
  )
}

export default React.memo(ChatbotChatHeader)
