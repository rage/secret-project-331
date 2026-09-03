"use client"

import { css } from "@emotion/css"
import { PlusCircle } from "@vectopus/atlas-icons-react"
import type React from "react"
import { useTranslation } from "react-i18next"

import type { DropdownMenuItem } from "@/components/DropdownMenu"
import DropdownMenu from "@/components/DropdownMenu"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const buttonStyle = css`
  background: none;
  border-width: medium;
  border-style: none;
  border-color: currentcolor;
  border-image: none;
  box-shadow: none;
  text-shadow: none;
`

const buttonStyleMobile = css`
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

interface DropdownButtonProps {
  setCreateChatbotVisible: React.Dispatch<boolean>
  isMobile: boolean
}

const DropdownButton: React.FC<DropdownButtonProps> = ({ setCreateChatbotVisible, isMobile }) => {
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
    <DropdownMenu
      // oxlint-disable-next-line i18next/no-literal-string
      menuTestId="chatbot-header-menu"
      // oxlint-disable-next-line i18next/no-literal-string
      menuButtonTestId="chatbot-header-menu-button"
      controlButtonClassName={isMobile ? buttonStyleMobile : buttonStyle}
      controlButtonIconColor={`${baseTheme.colors.green[700]}`}
      controlButtonAriaLabel={t("label-actions")}
      controlButtonTooltipText={t("label-actions")}
      controlButtonIconWidth={16}
      items={items}
    />
  )
}

export default DropdownButton
