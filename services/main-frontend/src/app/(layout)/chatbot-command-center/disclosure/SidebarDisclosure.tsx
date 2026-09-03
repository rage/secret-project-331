"use client"

import { css } from "@emotion/css"
import { useDisclosureState } from "@react-stately/disclosure"
import { AddMessage, LayoutVertical } from "@vectopus/atlas-icons-react"
import React, { useRef } from "react"
import type { ReactNode } from "react"
import { mergeProps } from "react-aria/mergeProps"
import { useButton } from "react-aria/useButton"
import { useDisclosure, type AriaDisclosureProps } from "react-aria/useDisclosure"
import { useFocusRing } from "react-aria/useFocusRing"
import { useHover } from "react-aria/useHover"

import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

import DropdownButton from "./DropdownButton"
import NewConversationButton from "./NewConversationButton"

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
    grid-template-columns 0.2s linear,
    opacity 0.2s linear,
    visibility 0.2s linear allow-discrete;

  &[aria-hidden="true"] {
    grid-template-columns: 0fr;
    opacity: 0;
    visibility: hidden;

    transition: none;
  }
`

const SideBarDisclosure: React.FC<DisclosureProps> = (props) => {
  let state = useDisclosureState(props)
  let panelRef = useRef<HTMLDivElement>(null)
  let buttonRef = useRef<HTMLButtonElement>(null)
  let { buttonProps, panelProps } = useDisclosure(props, state, panelRef)
  let { buttonProps: pressProps, isPressed } = useButton(buttonProps, buttonRef)
  let { hoverProps, isHovered } = useHover({})
  let { focusProps, isFocusVisible } = useFocusRing()

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
            <DropdownButton
              isMobile={false}
              setCreateChatbotVisible={props.setCreateChatbotVisible}
            />
            <NewConversationButton isMobile={false} setChatbotDialog={props.setChatbotDialog} />
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
