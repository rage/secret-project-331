/** @jsxImportSource react */
"use client"

import { cx } from "@emotion/css"
import NextLink from "next/link"
import React from "react"
import { mergeProps, useLink, useObjectRef, VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { joinAriaDescribedBy } from "../lib/utils/aria"
import { omitUndefined } from "../lib/utils/nullability"
import {
  type ButtonSize,
  type ButtonVariant,
  contentCss,
  contentLoadingCss,
  disabledPlainLinkCss,
  type IconPosition,
  iconSlotCss,
  type PressHandlers,
  resolveButtonRootCss,
  spinnerOverlayCss,
} from "./primitives/buttonStyles"
import { spinnerGlyphCss } from "./primitives/spinnerStyles"

// oxlint-disable-next-line i18next/no-literal-string
const SAME_TAB_TARGET = "_self"

/** Scheme-qualified (`https:`, `mailto:`) or protocol-relative (`//host/path`) hrefs. */
const ABSOLUTE_HREF = /^(?:[a-zA-Z][a-zA-Z\d+.-]*:|\/\/)/

type CommonLinkExtras = PressHandlers & {
  isDisabled?: boolean
  isLoading?: boolean
  loadingLabel?: string
  /**
   * Marks an `href` that another service in this deployment serves, such as `/cms/...` linked from
   * main-frontend. Such a path is same-origin but is not a route of this Next app, so the client
   * router must not claim the click, prepend `basePath` to the href, or prefetch it on scroll.
   *
   * Only for paths the component cannot classify on its own: `download`, a `target` other than
   * `_self`, and absolute URLs already skip the router without it.
   */
  isCrossService?: boolean
}

interface ButtonLikeStyling {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  iconPosition?: IconPosition
}

type NextProps = React.ComponentProps<typeof NextLink>

/** `href` is narrowed to a string: a `UrlObject` cannot be handed to a plain anchor. */
type LinkSharedProps = Omit<NextProps, "href"> & CommonLinkExtras & { href: string }

type LinkPlainProps = LinkSharedProps & {
  styledAsButton?: false | undefined
}

type LinkButtonProps = LinkSharedProps &
  ButtonLikeStyling & {
    /**
     * Paints the link with `Button`'s variant and size styling, and enables `variant`, `size`,
     * `icon` and `iconPosition`.
     *
     * The element stays a link however it looks: Enter activates it and Space scrolls the page.
     */
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
      isCrossService,
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
      className,
      children,
      tabIndex,
      href,
      as: routerAs,
      replace,
      scroll,
      shallow,
      passHref,
      prefetch,
      locale,
      legacyBehavior,
      onNavigate,
      transitionTypes,
      ...rest
    } = props as LinkProps & ButtonLikeStyling

    const styledAsButtonResolved = styledAsButton === true

    const { t } = useTranslation("shared-module")

    const isLoading = Boolean(isLoadingProp)
    const disabled = Boolean(isDisabledProp)
    const isInteractivelyDisabled = isLoading || disabled

    const loadingLabel = loadingLabelProp ?? t("link.loading")
    const loadingDescId = React.useId()
    const labelId = React.useId()

    const describedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      isLoading && styledAsButtonResolved ? loadingDescId : undefined,
    )
    const userAriaLabel = ariaLabelProp
    const userLabelledBy = ariaLabelledByProp
    const labelledBy = userAriaLabel
      ? undefined
      : (userLabelledBy ?? (styledAsButtonResolved ? labelId : undefined))

    const ref = useObjectRef(forwardedRef)

    const { linkProps, isPressed } = useLink(
      {
        isDisabled: isInteractivelyDisabled,
        ...omitUndefined({
          onPress,
          onPressStart,
          onPressEnd,
          onPressChange,
          onPressUp,
          "aria-label": userAriaLabel,
          "aria-describedby": describedBy,
          "aria-labelledby": labelledBy,
        }),
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

    const stateCss = styledAsButtonResolved
      ? resolveButtonRootCss({
          size: (styledAsButtonResolved ? size : undefined) ?? "medium",
          variant: (styledAsButtonResolved ? variant : undefined) ?? "primary",
        })
      : isInteractivelyDisabled
        ? disabledPlainLinkCss
        : undefined

    const rootClassName = cx(stateCss, className) || undefined

    const resolvedIcon = styledAsButtonResolved ? icon : undefined
    // oxlint-disable-next-line i18next/no-literal-string
    const defaultIconPosition: IconPosition = "start"
    const resolvedIconPosition =
      (styledAsButtonResolved ? iconPosition : undefined) ?? defaultIconPosition

    // oxlint-disable-next-line i18next/no-literal-string
    const disabledReason = isLoading ? "loading" : isInteractivelyDisabled ? "disabled" : undefined

    // next/link claims every same-origin href: it cancels the click, prefetches the URL on scroll
    // and prepends basePath. A destination it does not route must render as a plain anchor instead.
    const opensAnotherBrowsingContext =
      typeof props.target === "string" && props.target !== SAME_TAB_TARGET
    const isDownload = props.download !== undefined && props.download !== false
    const usesClientRouter =
      isCrossService !== true &&
      !isDownload &&
      !opensAnotherBrowsingContext &&
      !ABSOLUTE_HREF.test(href)

    const anchorProps = mergeProps(
      linkProps,
      {
        onClick: isInteractivelyDisabled ? undefined : onClick,
        onPointerDown,
        onPointerUp,
        onPointerCancel,
        onKeyDown,
        onKeyUp,
        onFocus,
        onBlur,
      },
      rest,
      {
        className: rootClassName,
        tabIndex: finalTabIndex,
        "data-pressed": isPressed,
        "data-disabled-reason": disabledReason,
        "aria-busy": isLoading || undefined,
      },
    )

    const content = styledAsButtonResolved ? (
      <>
        <span className={cx(contentCss, isLoading ? contentLoadingCss : undefined)}>
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
              <span className={spinnerGlyphCss("sm", "current")} />
            </span>
            <VisuallyHidden id={loadingDescId}>{loadingLabel}</VisuallyHidden>
          </>
        ) : null}
      </>
    ) : (
      children
    )

    if (!usesClientRouter) {
      return (
        <a
          {...(anchorProps as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          href={href}
          ref={ref}
        >
          {content}
        </a>
      )
    }

    // Router-only props: not anchor attributes, so they must never reach the plain-anchor path.
    const clientRouterProps = omitUndefined({
      as: routerAs,
      replace,
      scroll,
      shallow,
      passHref,
      prefetch,
      locale,
      legacyBehavior,
      onNavigate,
      transitionTypes,
    })

    return (
      <NextLink
        {...(anchorProps as Partial<NextProps>)}
        {...clientRouterProps}
        href={href}
        ref={ref}
      >
        {content}
      </NextLink>
    )
  },
)
