"use client"

import { css } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import type { OverlayTriggerState } from "@react-stately/overlays"
import { AddMessage } from "@vectopus/atlas-icons-react"
import type React from "react"
import { OverlayContainer } from "react-aria"
import { useTranslation } from "react-i18next"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

import ConversationHistory from "./ConversationHistory"
import { DisclosureButton } from "./disclosure/DisclosureButton"
import MobileDisclosureOverlay from "./disclosure/MobileDisclosureOverlay"
import SideBarDisclosure from "./disclosure/SidebarDisclosure"

interface SideBarProps {
  setChatbotDialog: React.Dispatch<boolean>
  conversations: ChatbotConversation[]
  chatbots: ChatbotConfiguration[]
  setConfigurationId: React.Dispatch<string>
}

interface SideBarContentProps extends SideBarProps {
  menuState: OverlayTriggerState
}

const sideBarContainer = css`
  border-radius: 10px;
  margin: 0;
  padding: 0;
  padding-top: 0.5rem;
  overflow-y: auto;
  box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
  max-width: 400px;
  height: 85vh;
`

const SideBarContent: React.FC<SideBarContentProps> = ({
  setChatbotDialog,
  menuState,
  conversations,
  chatbots,
  setConfigurationId,
}) => {
  const { t } = useTranslation()

  return (
    <>
      <Button
        className={css`
          padding-bottom: 1rem;
          color: var(--field-fg);
          text-wrap: nowrap;
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
      >
        {t("new-conversation")}
      </Button>
      <ConversationHistory
        menuState={menuState}
        conversations={conversations}
        chatbots={chatbots}
        setConfigurationId={setConfigurationId}
      />
    </>
  )
}

const SideBar: React.FC<SideBarProps> = (props) => {
  const { setChatbotDialog, conversations, setConfigurationId, chatbots } = props
  const menuState = useOverlayTriggerState({})
  return (
    <div className={sideBarContainer}>
      <DisclosureButton state={menuState} />
      {menuState.isOpen && (
        <OverlayContainer>
          <MobileDisclosureOverlay state={menuState} onClose={menuState.close}>
            <SideBarContent
              setChatbotDialog={setChatbotDialog}
              menuState={menuState}
              conversations={conversations}
              chatbots={chatbots}
              setConfigurationId={setConfigurationId}
            />
          </MobileDisclosureOverlay>
        </OverlayContainer>
      )}
      <SideBarDisclosure defaultExpanded={true}>
        <SideBarContent
          setChatbotDialog={setChatbotDialog}
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
