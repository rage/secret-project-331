"use client"

import { css } from "@emotion/css"
import { useDisclosureState } from "@react-stately/disclosure"
import { useOverlayTriggerState } from "@react-stately/overlays"
import { AddMessage, LayoutVertical, PlusCircle } from "@vectopus/atlas-icons-react"
import type React from "react"
import { useRef } from "react"
import { mergeProps, OverlayContainer, useButton, useFocusRing, useHover } from "react-aria"
import { useDisclosure } from "react-aria/useDisclosure"
import { useTranslation } from "react-i18next"

import type { DropdownMenuItem } from "@/components/DropdownMenu"
import DropdownMenu from "@/components/DropdownMenu"
import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

import ConversationHistory from "./ConversationHistory"
import { DisclosureButton } from "./sidebar-disclosure/DisclosureButton"
import MobileDisclosureOverlay from "./sidebar-disclosure/MobileDisclosureOverlay"
import SidebarDisclosure from "./sidebar-disclosure/SidebarDisclosure"

interface SideBarProps {
  setChatbotDialog: React.Dispatch<boolean>
  conversations: ChatbotConversation[]
  chatbots: ChatbotConfiguration[]
  setConfigurationId: React.Dispatch<string>
  setCreateChatbotVisible: React.Dispatch<boolean>
}

const sideBarContainerCss = css`
  border-radius: 10px;
  margin: 0;
  padding: 0;
  box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};

  // Applied when disclosure is open
  &:has(> [data-expanded]) {
    overflow-y: auto;
    overflow-x: hidden;
  }
`
const dropdownMenuCss = css`
  background: none;
  border-width: medium;
  border-style: none;
  border-color: currentcolor;
  border-image: none;
  box-shadow: none;
  text-shadow: none;
`

const Sidebar: React.FC<SideBarProps> = (props) => {
  const { t } = useTranslation()
  const { setChatbotDialog, conversations, setConfigurationId, chatbots, setCreateChatbotVisible } =
    props
  const menuState = useOverlayTriggerState({})

  let buttonRef = useRef<HTMLButtonElement>(null)
  let panelRef = useRef<HTMLDivElement>(null)
  let state = useDisclosureState({ defaultExpanded: true })
  let { buttonProps, panelProps } = useDisclosure({}, state, panelRef)
  let { buttonProps: pressProps, isPressed } = useButton(buttonProps, buttonRef)
  let { hoverProps, isHovered } = useHover({})
  let { focusProps, isFocusVisible } = useFocusRing()

  const disclosureButtonCss = css`
    background: none;
    border: none;
    box-shadow: none;
    text-shadow: none;
    padding: 12px 16px;
    border-radius: 12px;
    &[data-hovered] {
      background: #f3f4f6;
      cursor: pointer;
    }
    @media (max-width: 767.98px) {
      display: none !important;
    }
  `

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
    <>
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
      <div className={sideBarContainerCss}>
        <div
          className={css`
            display: flex;
            align-items: baseline;
            justify-content: space-between;

            flex-direction: ${!state.isExpanded ? "column-reverse" : "row"};

            @media (max-width: 767.98px) {
              flex-direction: column-reverse;
            }
          `}
        >
          <div
            className={css`
              display: flex;
              flex-direction: ${!state.isExpanded ? "column" : "row"};
              align-items: center;
              @media (max-width: 767.98px) {
                flex-direction: column;
              }
            `}
          >
            <OnlyRenderIfPermissions
              action={{ type: "edit" }}
              resource={{ type: "global_permissions" }}
            >
              <DropdownMenu
                // oxlint-disable-next-line i18next/no-literal-string
                menuTestId="chatbot-header-menu"
                // oxlint-disable-next-line i18next/no-literal-string
                menuButtonTestId="sidebar-header-menu-button"
                controlButtonClassName={dropdownMenuCss}
                controlButtonIconColor={`${baseTheme.colors.green[700]}`}
                controlButtonAriaLabel={t("label-actions")}
                controlButtonTooltipText={t("label-actions")}
                controlButtonIconWidth={16}
                items={items}
              />
              <Button
                className={css`
                  color: var(--field-fg);
                  text-wrap: nowrap;
                  padding: 0;

                  // Hide button text when disclosure collapsed
                  // and when on mobile
                  & span[id]:last-of-type {
                    display: ${!state.isExpanded ? "none" : "block"};
                    @media (max-width: 767.98px) {
                      display: none !important;
                    }
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
              >
                {t("new-conversation")}
              </Button>
            </OnlyRenderIfPermissions>
          </div>
          <button
            {...mergeProps(pressProps, hoverProps, focusProps)}
            ref={buttonRef}
            slot="trigger"
            className={disclosureButtonCss}
            data-pressed={isPressed || undefined}
            data-hovered={isHovered || undefined}
            data-focus-visible={isFocusVisible || undefined}
            data-disabled={undefined}
            aria-label={state.isExpanded ? t("close-sidebar") : t("open-sidebar")}
          >
            <LayoutVertical weight="medium" size={16} />
          </button>
          <DisclosureButton state={menuState} />
        </div>
        <SidebarDisclosure state={state} panelProps={panelProps} panelRef={panelRef}>
          <ConversationHistory
            menuState={menuState}
            conversations={conversations}
            chatbots={chatbots}
            setConfigurationId={setConfigurationId}
          />
        </SidebarDisclosure>
      </div>
    </>
  )
}

export default Sidebar
