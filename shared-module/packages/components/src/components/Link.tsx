"use client"

import NextLink from "next/link"
import React from "react"
import { useLink, useObjectRef } from "react-aria"

import { joinAriaDescribedBy } from "../lib/utils/aria"
import { mergeHandlers } from "../lib/utils/handlers"

import {
  type ButtonSize,
  type ButtonVariant,
  contentCss,
  type IconPosition,
  iconSlotCss,
  type PressHandlers,
  resolveButtonRootCss,
  spinnerCss,
  spinnerOverlayCss,
  srOnlyCss,
} from "./primitives/buttonStyles"

type CommonLinkExtras = PressHandlers & {
  isDisabled?: boolean
  isLoading?: boolean
  loadingLabel?: string
}

type ButtonLikeStyling = {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  iconPosition?: IconPosition
}

type NextProps = React.ComponentProps<typeof NextLink>

type LinkPlainProps = NextProps &
  CommonLinkExtras & {
    styledAsButton?: false | undefined
  }

type LinkButtonProps = NextProps &
  CommonLinkExtras &
  ButtonLikeStyling & {
    styledAsButton: true
  }

export type LinkProps = LinkPlainProps | LinkButtonProps

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  function Link(props, forwardedRef) {
    const {
      styledAsButton,
      variant,
      size,
      icon,
      iconPosition,
      isLoading: isLoadingProp,
      isDisabled: isDisabledProp,
      loadingLabel: loadingLabelProp,
      onPress,
      onPressStart,
      onPressEnd,
      onPressChange,
      onPressUp,
      "aria-describedby": ariaDescribedByProp,
      "aria-labelledby": ariaLabelledByProp,
      "aria-label": ariaLabelProp,
      onClick,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      children,
      tabIndex,
      ...rest
    } = props as LinkProps & ButtonLikeStyling

    const styledAsButtonResolved = styledAsButton === true

    const isLoading = Boolean(isLoadingProp)
    const disabled = Boolean(isDisabledProp)
    const isInteractivelyDisabled = isLoading || disabled

    // eslint-disable-next-line i18next/no-literal-string
    const defaultLoadingLabel = "Loading"
    const loadingLabel = loadingLabelProp ?? defaultLoadingLabel
    const loadingDescId = React.useId()
    const labelId = React.useId()

    const describedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      isLoading ? loadingDescId : undefined,
    )
    const userAriaLabel = ariaLabelProp
    const userLabelledBy = ariaLabelledByProp
    const labelledBy = userAriaLabel
      ? undefined
      : (userLabelledBy ?? (styledAsButtonResolved ? labelId : undefined))

    const ref = useObjectRef(forwardedRef)

    const { linkProps, isPressed } = useLink(
      {
        onPress,
        onPressStart,
        onPressEnd,
        onPressChange,
        onPressUp,
        isDisabled: isInteractivelyDisabled,
        "aria-label": userAriaLabel,
        "aria-describedby": describedBy,
        "aria-labelledby": labelledBy,
      },
      ref,
    )

    // Keep focusable when disabled/loading unless user explicitly set tabIndex.
    const userTabIndex = tabIndex
    const finalTabIndex =
      typeof userTabIndex === "number"
        ? userTabIndex
        : isInteractivelyDisabled
          ? 0
          : linkProps.tabIndex

    const rootClassName = styledAsButtonResolved
      ? resolveButtonRootCss({
          size: (styledAsButtonResolved ? size : undefined) ?? "md",
          variant: (styledAsButtonResolved ? variant : undefined) ?? "primary",
        })
      : undefined

    const resolvedIcon = styledAsButtonResolved ? icon : undefined
    // eslint-disable-next-line i18next/no-literal-string
    const defaultIconPosition: IconPosition = "start"
    const resolvedIconPosition =
      (styledAsButtonResolved ? iconPosition : undefined) ?? defaultIconPosition

    return (
      <NextLink
        {...linkProps}
        {...rest}
        ref={ref}
        className={rootClassName}
        data-pressed={isPressed ? "true" : "false"}
        data-disabled-reason={
          isLoading ? "loading" : isInteractivelyDisabled ? "disabled" : undefined
        }
        // eslint-disable-next-line i18next/no-literal-string
        aria-busy={isLoading ? "true" : undefined}
        tabIndex={finalTabIndex}
        onClick={mergeHandlers(linkProps.onClick, onClick)}
        onPointerDown={mergeHandlers(linkProps.onPointerDown, onPointerDown)}
        onPointerUp={mergeHandlers(linkProps.onPointerUp, onPointerUp)}
        onPointerCancel={mergeHandlers(linkProps.onPointerCancel, onPointerCancel)}
        onKeyDown={mergeHandlers(linkProps.onKeyDown, onKeyDown)}
        onKeyUp={mergeHandlers(linkProps.onKeyUp, onKeyUp)}
        onFocus={mergeHandlers(linkProps.onFocus, onFocus)}
        onBlur={mergeHandlers(linkProps.onBlur, onBlur)}
      >
        {styledAsButtonResolved ? (
          <>
            <span className={contentCss}>
              {resolvedIcon && resolvedIconPosition === "start" ? (
                <span className={iconSlotCss}>{resolvedIcon}</span>
              ) : null}
              <span id={labelledBy === labelId ? labelId : undefined}>{children}</span>
              {resolvedIcon && resolvedIconPosition === "end" ? (
                <span className={iconSlotCss}>{resolvedIcon}</span>
              ) : null}
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
          </>
        ) : (
          children
        )}
      </NextLink>
    )
  },
)
