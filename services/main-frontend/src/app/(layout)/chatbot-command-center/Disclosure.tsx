"use client"

import { css } from "@emotion/css"
import { useDisclosureState } from "@react-stately/disclosure"
import { LayoutVertical } from "@vectopus/atlas-icons-react"
import { useRef } from "react"
import type { ReactNode } from "react"
import { mergeProps } from "react-aria/mergeProps"
import { useButton } from "react-aria/useButton"
import { useDisclosure, type AriaDisclosureProps } from "react-aria/useDisclosure"
import { useFocusRing } from "react-aria/useFocusRing"
import { useHover } from "react-aria/useHover"

export interface DisclosureProps extends AriaDisclosureProps {
  title?: ReactNode
  children?: ReactNode
  defaultExpanded?: boolean
}

export function Disclosure(props: DisclosureProps) {
  let state = useDisclosureState(props)
  let panelRef = useRef<HTMLDivElement>(null)
  let buttonRef = useRef<HTMLButtonElement>(null)
  let { buttonProps, panelProps } = useDisclosure(props, state, panelRef)
  let { buttonProps: pressProps, isPressed } = useButton(buttonProps, buttonRef)
  let { hoverProps, isHovered } = useHover({})
  let { focusProps, isFocusVisible } = useFocusRing()

  const reactAriaDisclosure = css``

  const disclosureButton = css`
    background: none;
    border: none;
    box-shadow: none;
    text-shadow: none;
    padding: 0 12px;
  `

  const reactAriaDisclosurePanel = css`
    width: var(--disclosure-panel-width);
    transition: width 0.3s;
    overflow: auto;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `

  return (
    <div className={reactAriaDisclosure} data-expanded={state.isExpanded || undefined}>
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
        <span>{props.title}</span>
      </button>
      <div {...panelProps} ref={panelRef} className={reactAriaDisclosurePanel}>
        <div>{props.children}</div>
      </div>
    </div>
  )
}
