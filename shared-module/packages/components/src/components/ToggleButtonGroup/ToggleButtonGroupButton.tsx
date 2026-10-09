"use client"

import { cx } from "@emotion/css"
import {
  useContext,
  useRef,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
} from "react"
import { mergeProps, useFocusRing, useHover, useToggleButtonGroupItem } from "react-aria"

import { omitUndefined } from "../../lib/utils/nullability"
import { ToggleButtonGroupContext } from "./ToggleButtonGroup"
import { iconSlotCss, resolveButtonRootCss, type IconPosition } from "./toggleButtonStyles"

export interface ToggleButtonGroupButtonProps {
  id: string
  icon?: ReactNode
  iconPosition?: IconPosition
  isDisabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>
  onKeyUp?: KeyboardEventHandler<HTMLButtonElement>
  onFocus?: FocusEventHandler<HTMLButtonElement>
  onBlur?: FocusEventHandler<HTMLButtonElement>
  "aria-label"?: string
  className?: string
  children?: ReactNode
}

/** Renders a toggle button when nested inside `ToggleButtonGroup`. */
export function ToggleButtonGroupButton(props: ToggleButtonGroupButtonProps) {
  const {
    id,
    icon,
    iconPosition = "start",
    isDisabled = false,
    children,
    "aria-label": ariaLabel,
    onClick,
    onKeyDown,
    onKeyUp,
    onFocus,
    onBlur,
    className,
  } = props

  const group = useContext(ToggleButtonGroupContext)

  if (!group) {
    throw new Error("GroupedToggleButton must be used inside ToggleButtonGroup")
  }

  let ref = useRef<HTMLButtonElement>(null)
  const { focusProps, isFocusVisible } = useFocusRing()
  const { hoverProps, isHovered } = useHover(props)

  const { buttonProps, isSelected, isPressed } = useToggleButtonGroupItem(
    {
      id,
      isDisabled,
      ...omitUndefined({
        "aria-label": ariaLabel,
      }),
    },
    group.state,
    ref,
  )

  const size = group.fieldSize

  // oxlint-disable-next-line i18next/no-literal-string
  const variant = isSelected ? "selected" : "secondary"

  const rootClassName = cx(resolveButtonRootCss({ size, variant }), className)

  const mergedProps = mergeProps(buttonProps, focusProps, hoverProps, {
    onClick,
    onKeyDown,
    onKeyUp,
    onFocus,
    onBlur,
  })

  return (
    <button
      {...mergedProps}
      ref={ref}
      className={rootClassName}
      data-pressed={String(isPressed)}
      data-selected={String(isSelected)}
      data-hovered={String(isHovered)}
      data-focus-visible={String(isFocusVisible)}
      data-disabled={isDisabled}
      type="button"
    >
      {icon && iconPosition === "start" ? <span className={iconSlotCss}>{icon}</span> : null}
      <span>{children}</span>
      {icon && iconPosition === "end" ? <span className={iconSlotCss}>{icon}</span> : null}
    </button>
  )
}
