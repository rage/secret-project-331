"use client"

import { css } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import { AddMessage } from "@vectopus/atlas-icons-react"
import type React from "react"
import { OverlayContainer } from "react-aria"
import { useTranslation } from "react-i18next"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

import ConversationHistory from "./ConversationHistory"
import Disclosure from "./Disclosure"
import { DisclosureButton } from "./DisclosureButton"
import MobileDisclosureOverlay from "./MobileDisclosureOverlay"

interface SideBarProps {
  setChatbotDialog: React.Dispatch<boolean>
  conversations: ChatbotConversation[]
  setConversationId: React.Dispatch<string>
  setConfigurationId: React.Dispatch<string>
  chatbots: ChatbotConfiguration[]
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

const SideBar: React.FC<SideBarProps> = (props) => {
  const { setChatbotDialog, conversations, setConversationId, setConfigurationId, chatbots } = props
  const menuState = useOverlayTriggerState({})
  const { t } = useTranslation()
  return (
    <div className={sideBarContainer}>
      <DisclosureButton state={menuState} />
      {menuState.isOpen && (
        <OverlayContainer>
          <MobileDisclosureOverlay state={menuState} onClose={menuState.close}>
            <Button
              className={css`
                padding-bottom: 1rem;
                color: var(--field-fg);
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
              setConversationId={setConversationId}
              setConfigurationId={setConfigurationId}
              chatbots={chatbots}
            />
          </MobileDisclosureOverlay>
        </OverlayContainer>
      )}
      <Disclosure defaultExpanded={true}>
        <Button
          className={css`
            padding-bottom: 1rem;
            color: var(--field-fg);
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
          conversations={conversations}
          setConversationId={setConversationId}
          setConfigurationId={setConfigurationId}
          chatbots={chatbots}
        />
      </Disclosure>
    </div>
  )
}

export default SideBar
