"use client"

import { cx } from "@emotion/css"
import type { FocusableElement } from "@react-types/shared"
import React from "react"
import { mergeProps, useButton, useObjectRef, VisuallyHidden } from "react-aria"
import type { AriaButtonOptions } from "react-aria"
import { useTranslation } from "react-i18next"

import { joinAriaDescribedBy } from "../lib/utils/aria"
import { omitUndefined } from "../lib/utils/nullability"
import {
  type ButtonSize,
  type ButtonVariant,
  contentCss,
  contentLoadingCss,
  type IconPosition,
  iconSlotCss,
  type PressHandlers,
  resolveButtonRootCss,
  spinnerOverlayCss,
} from "./primitives/buttonStyles"
import { spinnerGlyphCss } from "./primitives/spinnerStyles"

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
  | "autoFocus"
  | "disabledReason"
  | "isFullWidth"

export type ButtonDomProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, OwnedButtonDomKeys>

export type ButtonProps = PressHandlers & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  iconPosition?: IconPosition
  isLoading?: boolean
  loadingLabel?: string
  /** Stretches the button across its container; a medium one also grows to 44px tall. */
  isFullWidth?: boolean
  disabled?: boolean
  /**
   * Disables the button but keeps it focusable (aria-disabled), with this reason as its
   * description, so keyboard and screen reader users can find out why.
   */
  disabledReason?: string | undefined
  type?: "button" | "submit" | "reset"
  name?: string
  value?: string | number | readonly string[]
  formAction?: string
  /** Focuses the button on mount, before an enclosing dialog's own initial focus. */
  autoFocus?: boolean
  /**
   * An alternative to onPress. onPress is preferred, as it works better for
   * non-mouse interactions, but using onClick is required when using our
   * Button component with some other react-aria hooks. Providing useButton
   * with both onPress and onClick works: it combines the event handlers.
   */
  onClick?: (e: React.MouseEvent<FocusableElement>) => void
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
  "data-testid"?: string | undefined
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
      isFullWidth = false,
      disabled = false,
      disabledReason,
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
      autoFocus,
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
      "data-testid": dataTestId,
    } = props

    const { t } = useTranslation("shared-module")
    const loadingLabel = loadingLabelProp ?? t("button.loading")

    const isDisabled = disabled || isLoading
    const hasDisabledReason = !isDisabled && Boolean(disabledReason)

    const loadingDescId = React.useId()
    const disabledReasonId = React.useId()
    const labelId = React.useId()
    const describedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      isLoading ? loadingDescId : undefined,
      hasDisabledReason ? disabledReasonId : undefined,
    )
    const userAriaLabel = ariaLabelProp
    const userLabelledBy = ariaLabelledByProp
    const labelledBy = userAriaLabel ? undefined : (userLabelledBy ?? labelId)

    const ref = useObjectRef(forwardedRef)

    const ariaOptions: AriaButtonOptions<"button"> = {
      isDisabled,
      ...omitUndefined({
        ...(hasDisabledReason
          ? {}
          : { onPress, onClick, onPressStart, onPressEnd, onPressChange, onPressUp }),
        "aria-label": userAriaLabel,
        "aria-describedby": describedBy,
        "aria-labelledby": labelledBy,
        autoFocus,
      }),
    }

    const { buttonProps, isPressed } = useButton(ariaOptions, ref)

    const rootClassName = cx(resolveButtonRootCss({ size, variant, isFullWidth }), className)

    const disabledReasonProps: React.ButtonHTMLAttributes<HTMLButtonElement> = hasDisabledReason
      ? {
          "aria-disabled": true,
          // Keeps a submit button from submitting its form.
          onClick: (e) => e.preventDefault(),
        }
      : {}

    const mergedButtonProps = mergeProps(
      buttonProps,
      domProps ?? {},
      {
        onPointerDown,
        onPointerUp,
        onPointerCancel,
        onKeyDown,
        onKeyUp,
        onFocus,
        onBlur,
      } satisfies React.ButtonHTMLAttributes<HTMLButtonElement>,
      disabledReasonProps,
    )

    return (
      <button
        {...mergedButtonProps}
        ref={ref}
        className={rootClassName}
        data-pressed={isPressed ? "true" : "false"}
        data-disabled-reason={
          isLoading ? "loading" : isDisabled || hasDisabledReason ? "disabled" : undefined
        }
        data-testid={dataTestId}
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
              <span className={spinnerGlyphCss("sm", "current")} />
            </span>
            <VisuallyHidden id={loadingDescId}>{loadingLabel}</VisuallyHidden>
          </>
        ) : null}
        {hasDisabledReason ? (
          <VisuallyHidden id={disabledReasonId}>{disabledReason}</VisuallyHidden>
        ) : null}
      </button>
    )
  },
)
