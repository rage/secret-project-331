"use client"

import { cx } from "@emotion/css"
import React from "react"
import { mergeProps, useButton, useObjectRef, VisuallyHidden } from "react-aria"
import type { AriaButtonOptions } from "react-aria"
import { useTranslation } from "react-i18next"

import { joinAriaDescribedBy } from "../lib/utils/aria"

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
} from "./primitives/buttonStyles"

type OwnedButtonDomKeys =
  | keyof PressHandlers
  | "children"
  | "className"
  | "disabled"
  | "type"
  | "name"
  | "value"
  | "formAction"
  | "onClick"
  | "onPointerDown"
  | "onPointerUp"
  | "onPointerCancel"
  | "onKeyDown"
  | "onKeyUp"
  | "onFocus"
  | "onBlur"
  | "aria-describedby"
  | "aria-labelledby"
  | "aria-label"
  | "variant"
  | "size"
  | "icon"
  | "iconPosition"
  | "isLoading"
  | "loadingLabel"

export type ButtonDomProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, OwnedButtonDomKeys>

export type ButtonProps = PressHandlers & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  iconPosition?: IconPosition
  isLoading?: boolean
  loadingLabel?: string
  disabled?: boolean
  type?: "button" | "submit" | "reset"
  name?: string
  value?: string | number | readonly string[]
  formAction?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>
  onPointerCancel?: React.PointerEventHandler<HTMLButtonElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>
  onFocus?: React.FocusEventHandler<HTMLButtonElement>
  onBlur?: React.FocusEventHandler<HTMLButtonElement>
  "aria-describedby"?: string
  "aria-labelledby"?: string
  "aria-label"?: string
  className?: string
  children?: React.ReactNode
  domProps?: ButtonDomProps
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, forwardedRef) {
    const {
      variant = "primary",
      size = "medium",
      icon,
      iconPosition = "start",
      isLoading = false,
      loadingLabel: loadingLabelProp,
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
      className,
      domProps,
      name,
    } = props

    const { t } = useTranslation("shared-module")
    const loadingLabel = loadingLabelProp ?? t("button.loading")

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

    const rootClassName = cx(resolveButtonRootCss({ size, variant }), className)

    const mergedButtonProps = mergeProps(buttonProps, domProps ?? {}, {
      onClick,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
    } satisfies React.ButtonHTMLAttributes<HTMLButtonElement>)

    return (
      <button
        {...mergedButtonProps}
        ref={ref}
        className={rootClassName}
        data-pressed={isPressed ? "true" : "false"}
        data-disabled-reason={isLoading ? "loading" : isDisabled ? "disabled" : undefined}
        aria-busy={isLoading ? "true" : undefined}
        formAction={formAction}
        disabled={isDisabled}
        type={props.type ?? "button"}
        name={name}
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
            <VisuallyHidden id={loadingDescId}>{loadingLabel}</VisuallyHidden>
          </>
        ) : null}
      </button>
    )
  },
)
