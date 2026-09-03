"use client"

import { css } from "@emotion/css"
import { useDisclosureState } from "@react-stately/disclosure"
import { AddMessage, LayoutVertical, PlusCircle } from "@vectopus/atlas-icons-react"
import React, { useRef } from "react"
import type { ReactNode } from "react"
import { mergeProps } from "react-aria/mergeProps"
import { useButton } from "react-aria/useButton"
import { useDisclosure, type AriaDisclosureProps } from "react-aria/useDisclosure"
import { useFocusRing } from "react-aria/useFocusRing"
import { useHover } from "react-aria/useHover"
import { useTranslation } from "react-i18next"

import DropdownMenu, { type DropdownMenuItem } from "@/components/DropdownMenu"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

interface DisclosureProps extends AriaDisclosureProps {
  title?: ReactNode
  children?: ReactNode
  defaultExpanded?: boolean
  setChatbotDialog: React.Dispatch<boolean>
  setCreateChatbotVisible: React.Dispatch<boolean>
}

const reactAriaDisclosure = css`
  @media (max-width: 767.98px) {
    display: none !important;
  }
`

const disclosureButton = css`
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
`

const reactAriaDisclosurePanel = css`
  display: grid;
  grid-template-columns: 1fr;
  opacity: 1;
  visibility: visible;
  overflow: hidden;
  transition:
    grid-template-columns 0.3s ease-in-out,
    opacity 0.3s ease-in-out,
    visibility 0.3s ease-in-out allow-discrete;

  &[aria-hidden="true"] {
    grid-template-columns: 0fr;
    opacity: 0;
    visibility: hidden;
  }
`

const buttonStyle = css`
  background: none;
  border-width: medium;
  border-style: none;
  border-color: currentcolor;
  border-image: none;
  box-shadow: none;
  text-shadow: none;
`

const SideBarDisclosure: React.FC<DisclosureProps> = (props) => {
  let state = useDisclosureState(props)
  let panelRef = useRef<HTMLDivElement>(null)
  let buttonRef = useRef<HTMLButtonElement>(null)
  let { buttonProps, panelProps } = useDisclosure(props, state, panelRef)
  let { buttonProps: pressProps, isPressed } = useButton(buttonProps, buttonRef)
  let { hoverProps, isHovered } = useHover({})
  let { focusProps, isFocusVisible } = useFocusRing()

  const { t } = useTranslation()

  let items: DropdownMenuItem[] = [
    {
      // oxlint-disable-next-line i18next/no-literal-string
      id: "chatbot-header-menu-new-conversation-button",
      onAction: () => {
        props.setCreateChatbotVisible(true)
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
    <div className={reactAriaDisclosure} data-expanded={state.isExpanded || undefined}>
      <div
        className={css`
          display: flex;
          align-items: baseline;
          justify-content: space-between;

          flex-direction: ${!state.isExpanded ? "column-reverse" : "row"};
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: ${!state.isExpanded ? "column" : "row"};
            align-items: center;
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
              menuButtonTestId="chatbot-header-menu-button"
              controlButtonClassName={buttonStyle}
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
                & span[id]:last-of-type {
                  display: ${!state.isExpanded ? "none" : "block"};
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
              onClick={() => props.setChatbotDialog(true)}
            >
              New conversation
            </Button>
          </OnlyRenderIfPermissions>
        </div>
        <button
          {...mergeProps(pressProps, hoverProps, focusProps)}
          ref={buttonRef}
          slot="trigger"
          className={disclosureButton}
          data-pressed={isPressed || undefined}
          data-hovered={isHovered || undefined}
          data-focus-visible={isFocusVisible || undefined}
          data-disabled={props.isDisabled || undefined}
        >
          <LayoutVertical weight="medium" size={16} />
        </button>
      </div>
      <div {...panelProps} ref={panelRef} className={reactAriaDisclosurePanel}>
        <div>{props.children}</div>
      </div>
    </div>
  )
}

export default SideBarDisclosure
