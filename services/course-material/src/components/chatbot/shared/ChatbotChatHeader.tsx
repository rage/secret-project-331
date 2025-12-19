import { css } from "@emotion/css"
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { Account, AddMessage, Hamburger } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useButton, useMenuTrigger } from "react-aria"
import { Button, Heading, Menu, MenuItem, Popover } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { DiscrChatbotDialogProps } from "../Chatbot/ChatbotChat"

import { ChatbotConversation, ChatbotConversationInfo } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import DownIcon from "@/shared-module/common/img/down.svg"
import { baseTheme } from "@/shared-module/common/styles"

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

const menuStyle = css`
  background: white;
`

const ChatbotChatHeader: React.FC<ChatbotChatHeaderProps> = (props) => {
  const { t } = useTranslation()
  const { currentConversationInfo, newConversation, isCourseMaterialBlock } = props
  let [isOpen, setIsOpen] = useState(false)
  let menuState = {
    isOpen,
    focusStrategy: false,
    close: () => setIsOpen(false),
    setOpen: () => setIsOpen(true),
    open: () => setIsOpen(true),
    toggle: () => setIsOpen(!isOpen),
  }

  // Get props for the button and menu elements
  let ref = React.useRef(null)
  let { menuTriggerProps, menuProps } = useMenuTrigger(
    {},
    {
      isOpen,
      // eslint-disable-next-line i18next/no-literal-string
      focusStrategy: "first",
      close: () => setIsOpen(false),
      setOpen: () => setIsOpen(true),
      open: () => setIsOpen(true),
      toggle: () => setIsOpen(!isOpen),
    },
    ref,
  )
  let { buttonProps } = useButton(menuTriggerProps, ref)
  let { autoFocus, ...menuProps2 } = menuProps

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
        {
          // controls the dialog. is there a slot that can prevent this?
        }
        <button className={buttonStyle} {...buttonProps}>
          <Hamburger
            className={css`
              position: relative;
              top: 0.25rem;
            `}
          />
        </button>
        {menuState.isOpen && (
          <Popover triggerRef={ref} isNonModal={true}>
            <ul className={menuStyle} {...menuProps2}>
              <button
                onClick={() => {
                  if (!newConversation.isPending) {
                    newConversation.mutate()
                  }
                }}
                className={buttonStyle}
                aria-label={t("new-conversation")}
              >
                <AddMessage
                  className={css`
                    position: relative;
                    top: 0.25rem;
                  `}
                />
              </button>
            </ul>
          </Popover>
        )}

        {!isCourseMaterialBlock && (
          <Button slot="close" className={buttonStyle} aria-label={t("close")}>
            <DownIcon />
          </Button>
        )}
      </div>
    </div>
  )
}

export default React.memo(ChatbotChatHeader)
