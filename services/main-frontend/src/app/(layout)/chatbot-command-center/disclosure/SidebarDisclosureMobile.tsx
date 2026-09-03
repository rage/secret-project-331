"use client"

import { css } from "@emotion/css"
import type { OverlayTriggerState } from "@react-stately/overlays"
import { AddMessage } from "@vectopus/atlas-icons-react"
import type React from "react"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { baseTheme } from "@/shared-module/common/styles/theme"
import { Button } from "@/shared-module/components"

import { DisclosureButton } from "./DisclosureButton"
import DropdownButton from "./DropdownButton"

interface SidebarDisclosureMobileProps {
  menuState: OverlayTriggerState
  setChatbotDialog: React.Dispatch<boolean>
  setCreateChatbotVisible: React.Dispatch<boolean>
}

const SidebarDisclosureMobile: React.FC<SidebarDisclosureMobileProps> = ({
  menuState,
  setChatbotDialog,
  setCreateChatbotVisible,
}) => {
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
      <DropdownButton isMobile={true} setCreateChatbotVisible={setCreateChatbotVisible} />
    </div>
  )
}

export default SidebarDisclosureMobile
