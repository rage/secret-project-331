"use client"

import { css } from "@emotion/css"
import { AddMessage } from "@vectopus/atlas-icons-react"
import type React from "react"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Button } from "@/shared-module/components"

interface NewConversationButtonProps {
  setChatbotDialog: React.Dispatch<boolean>
  isMobile: boolean
}

const mobileButtonCss = css`
  color: var(--field-fg);
  text-wrap: nowrap;
  padding: 0;
  ${respondToOrLarger.md} {
    display: none;
  }
`

const buttonCss = css`
  color: var(--field-fg);
  text-wrap: nowrap;
  padding: 0;
`

const NewConversationButton: React.FC<NewConversationButtonProps> = ({
  setChatbotDialog,
  isMobile,
}) => {
  return (
    <Button
      className={isMobile ? mobileButtonCss : buttonCss}
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
  )
}

export default NewConversationButton
