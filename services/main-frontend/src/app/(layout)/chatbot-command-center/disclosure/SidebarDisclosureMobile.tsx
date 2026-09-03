"use client"

import { css } from "@emotion/css"
import { AddMessage, PlusCircle } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import DropdownMenu, { type DropdownMenuItem } from "@/components/DropdownMenu"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { baseTheme } from "@/shared-module/common/styles/theme"
import { Button } from "@/shared-module/components"

import { DisclosureButton } from "./DisclosureButton"

const buttonStyle = css`
  background: none;
  border-width: medium;
  border-style: none;
  border-color: currentcolor;
  border-image: none;
  box-shadow: none;
  text-shadow: none;
  ${respondToOrLarger.md} {
    display: none;
  }
`

const SidebarDisclosureMobile = ({ menuState, setChatbotDialog, setCreateChatbotVisible }) => {
  const { t } = useTranslation()

  let items: DropdownMenuItem[] = [
    {
      // oxlint-disable-next-line i18next/no-literal-string
      id: "chatbot-header-menu-new-conversation-button",
      onAction: () => {
        setCreateChatbotVisible(true)
      },
      icon: (
        <PlusCircle
          className={css`
            color: ${baseTheme.colors.green[700]};
            position: relative;
            top: -0.25rem;
          `}
        />
      ),
      type: "action",
      label: t("create-global-chatbot"),
    },
  ]

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <DisclosureButton state={menuState} />
      <Button
        className={css`
          color: var(--field-fg);
          text-wrap: nowrap;
          padding: 0;
          ${respondToOrLarger.md} {
            display: none;
          }
        `}
        icon={
          <AddMessage
            className={css`
              color: ${baseTheme.colors.green[700]};
            `}
          />
        }
        // oxlint-disable-next-line i18next/no-literal-string
        iconPosition="start"
        size="medium"
        variant="icon"
        onClick={() => setChatbotDialog(true)}
      ></Button>
      <DropdownMenu
        // oxlint-disable-next-line i18next/no-literal-string
        menuTestId="chatbot-header-menu"
        // oxlint-disable-next-line i18next/no-literal-string
        menuButtonTestId="chatbot-header-menu-button"
        controlButtonClassName={buttonStyle}
        controlButtonIconColor={`${baseTheme.colors.green[700]}`}
        controlButtonAriaLabel={t("label-actions")}
        controlButtonTooltipText={t("label-actions")}
        controlButtonIconWidth={16}
        items={items}
      />
    </div>
  )
}

export default SidebarDisclosureMobile
