"use client"

import { css } from "@emotion/css"
import type { OverlayTriggerState } from "@react-stately/overlays"
import type React from "react"

import { DisclosureButton } from "./DisclosureButton"
import DropdownButton from "./DropdownButton"
import NewConversationButton from "./NewConversationButton"

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
      <NewConversationButton isMobile={true} setChatbotDialog={setChatbotDialog} />
      <DropdownButton isMobile={true} setCreateChatbotVisible={setCreateChatbotVisible} />
    </div>
  )
}

export default SidebarDisclosureMobile
