"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useButton, useObjectRef } from "react-aria"
import type { AriaButtonOptions } from "react-aria"

import { joinAriaDescribedBy } from "../lib/utils/aria"
import { mergeHandlers } from "../lib/utils/handlers"

import {
  type ButtonSize,
  type ButtonVariant,
  contentCss,
  contentLoadingCss,
  type IconPosition,
  iconSlotCss,
  type PressHandlers,
  resolveButtonRootCss,
  spinnerCss,
  spinnerOverlayCss,
  srOnlyCss,
} from "./primitives/buttonStyles"

export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> &
  PressHandlers & {
    variant?: ButtonVariant
    size?: ButtonSize
    icon?: React.ReactNode
    iconPosition?: IconPosition
    isLoading?: boolean
    loadingLabel?: string
    disabled?: boolean
  }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, forwardedRef) {
    const {
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "start",
      isLoading = false,
      loadingLabel = "Loading",
      disabled = false,
      children,
      onPress,
      onPressStart,
      onPressEnd,
      onPressChange,
      onPressUp,
      "aria-describedby": ariaDescribedByProp,
      "aria-labelledby": ariaLabelledByProp,
      "aria-label": ariaLabelProp,
      formAction,
      onClick,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
      ...rest
    } = props

    const isDisabled = disabled || isLoading

    const loadingDescId = React.useId()
    const labelId = React.useId()
    const describedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      isLoading ? loadingDescId : undefined,
    )
    const userAriaLabel = ariaLabelProp
    const userLabelledBy = ariaLabelledByProp
    const labelledBy = userAriaLabel ? undefined : (userLabelledBy ?? labelId)

    const ref = useObjectRef(forwardedRef)

    const ariaOptions: AriaButtonOptions<"button"> = {
      onPress,
      onPressStart,
      onPressEnd,
      onPressChange,
      onPressUp,
      isDisabled,
      "aria-label": userAriaLabel,
      "aria-describedby": describedBy,
      "aria-labelledby": labelledBy,
    }

    const { buttonProps, isPressed } = useButton(ariaOptions, ref)

    const rootClassName = resolveButtonRootCss({ size, variant })

    return (
      <button
        {...buttonProps}
        {...rest}
        ref={ref}
        className={rootClassName}
        data-pressed={isPressed ? "true" : "false"}
        data-disabled-reason={isLoading ? "loading" : isDisabled ? "disabled" : undefined}
        aria-busy={isLoading ? "true" : undefined}
        onClick={mergeHandlers(buttonProps.onClick, onClick)}
        formAction={formAction}
        onPointerDown={mergeHandlers(buttonProps.onPointerDown, onPointerDown)}
        onPointerUp={mergeHandlers(buttonProps.onPointerUp, onPointerUp)}
        onPointerCancel={mergeHandlers(buttonProps.onPointerCancel, onPointerCancel)}
        onKeyDown={mergeHandlers(buttonProps.onKeyDown, onKeyDown)}
        onKeyUp={mergeHandlers(buttonProps.onKeyUp, onKeyUp)}
        onFocus={mergeHandlers(buttonProps.onFocus, onFocus)}
        onBlur={mergeHandlers(buttonProps.onBlur, onBlur)}
        disabled={isDisabled}
        type={props.type ?? "button"}
      >
        <span className={cx(contentCss, isLoading ? contentLoadingCss : undefined)}>
          {icon && iconPosition === "start" ? <span className={iconSlotCss}>{icon}</span> : null}
          <span id={labelledBy === labelId ? labelId : undefined}>{children}</span>
          {icon && iconPosition === "end" ? <span className={iconSlotCss}>{icon}</span> : null}
        </span>

        {isLoading ? (
          <>
            <span className={spinnerOverlayCss} aria-hidden="true">
              <span className={spinnerCss} />
            </span>
            <span id={loadingDescId} className={srOnlyCss}>
              {loadingLabel}
            </span>
          </>
        ) : null}
      </button>
    )
  },
)
