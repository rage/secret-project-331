"use client"

import { css } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import type React from "react"
import { OverlayContainer } from "react-aria"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

import ConversationHistory from "./ConversationHistory"
import { DisclosureButton } from "./disclosure/DisclosureButton"
import MobileDisclosureOverlay from "./disclosure/MobileDisclosureOverlay"
import SideBarDisclosure from "./disclosure/SidebarDisclosure"

interface SideBarProps {
  setChatbotDialog: React.Dispatch<boolean>
  conversations: ChatbotConversation[]
  chatbots: ChatbotConfiguration[]
  setConfigurationId: React.Dispatch<string>
  setCreateChatbotVisible
}

const sideBarContainer = css`
  border-radius: 10px;
  margin: 0;
  padding: 0;
  padding-top: 0.5rem;
  overflow-y: auto;
  box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
  max-width: 400px;
`

const SideBar: React.FC<SideBarProps> = (props) => {
  const { setChatbotDialog, conversations, setConfigurationId, chatbots, setCreateChatbotVisible } =
    props
  const menuState = useOverlayTriggerState({})
  return (
    <div className={sideBarContainer}>
      <DisclosureButton state={menuState} />
      {menuState.isOpen && (
        <OverlayContainer>
          <MobileDisclosureOverlay state={menuState} onClose={menuState.close}>
            <ConversationHistory
              menuState={menuState}
              conversations={conversations}
              chatbots={chatbots}
              setConfigurationId={setConfigurationId}
            />
          </MobileDisclosureOverlay>
        </OverlayContainer>
      )}
      <SideBarDisclosure
        setCreateChatbotVisible={setCreateChatbotVisible}
        setChatbotDialog={setChatbotDialog}
        defaultExpanded={true}
      >
        <ConversationHistory
          menuState={menuState}
          conversations={conversations}
          chatbots={chatbots}
          setConfigurationId={setConfigurationId}
        />
      </SideBarDisclosure>
    </div>
  )
}

export default SideBar
