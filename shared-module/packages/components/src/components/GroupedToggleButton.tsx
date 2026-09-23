"use client"

import { cx } from "@emotion/css"
import React, { useContext } from "react"
import { mergeProps, useFocusRing, useObjectRef, useToggleButtonGroupItem } from "react-aria"

import { omitUndefined } from "../lib/utils/nullability"
import { iconSlotCss, resolveButtonRootCss, type IconPosition } from "./primitives/buttonStyles"
import { ToggleButtonGroupContext } from "./ToggleButtonGroup"

export interface GroupedToggleButtonProps {
  id: string
  icon?: React.ReactNode
  iconPosition?: IconPosition
  isDisabled?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>
  onFocus?: React.FocusEventHandler<HTMLButtonElement>
  onBlur?: React.FocusEventHandler<HTMLButtonElement>
  "aria-describedby"?: string
  "aria-labelledby"?: string
  "aria-label"?: string
  className?: string
  children?: React.ReactNode
}

export const GroupedToggleButton = React.forwardRef<HTMLButtonElement, GroupedToggleButtonProps>(
  function GroupedToggleButton(props, forwardedRef) {
    const {
      id,
      icon,
      iconPosition = "start",
      isDisabled = false,
      children,
      "aria-describedby": ariaDescribedByProp,
      "aria-labelledby": ariaLabelledByProp,
      "aria-label": ariaLabelProp,
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

    const ref = useObjectRef(forwardedRef)
    const { focusProps, isFocusVisible } = useFocusRing()

    const { buttonProps, isSelected, isPressed } = useToggleButtonGroupItem(
      {
        id,
        isDisabled,
        ...omitUndefined({
          "aria-label": ariaLabelProp,
          "aria-labelledby": ariaLabelledByProp,
          "aria-describedby": ariaDescribedByProp,
        }),
      },
      group.state,
      ref,
    )

    const size = group.fieldSize

    // oxlint-disable-next-line i18next/no-literal-string
    const variant = isSelected ? "primary" : "secondary"

    const rootClassName = cx(resolveButtonRootCss({ size, variant }), className)

    const mergedProps = mergeProps(buttonProps, focusProps, {
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
        data-focus-visible={String(isFocusVisible)}
        data-disabled={isDisabled}
        type="button"
      >
        {icon && iconPosition === "start" ? <span className={iconSlotCss}>{icon}</span> : null}
        <span>{children}</span>
        {icon && iconPosition === "end" ? <span className={iconSlotCss}>{icon}</span> : null}
      </button>
    )
  },
)
