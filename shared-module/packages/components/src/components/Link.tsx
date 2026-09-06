"use client"

import { css, cx } from "@emotion/css"
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
  type IconPosition,
  iconSlotCss,
  type PressHandlers,
  resolveButtonRootCss,
  spinnerCss,
  spinnerOverlayCss,
} from "./primitives/buttonStyles"

/**
 * How a plain (non-button) link is drawn.
 *
 * - `text` (the default) is the body-copy link: the site's link colour, underlined.
 * - `quiet` keeps the colour but underlines only on hover and focus, for a link that is the whole
 *   content of a table cell or a list row, where fifty underlines are the loudest thing on screen.
 * - `inherit` draws no colour or underline of its own: for a link wrapping a badge, a card or a
 *   row, or one on a surface that sets its own text colour.
 */
export type LinkAppearance = "text" | "quiet" | "inherit"

const plainLinkBaseCss = css`
  color: var(--color-green-700);
  text-underline-offset: 0.15em;

  &:hover {
    color: var(--color-green-800);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--space-1);
  }
`

const plainLinkCss: Record<LinkAppearance, string | undefined> = {
  text: cx(
    plainLinkBaseCss,
    css`
      text-decoration: underline;
    `,
  ),
  quiet: cx(
    plainLinkBaseCss,
    css`
      text-decoration: none;

      &:hover,
      &:focus-visible {
        text-decoration: underline;
      }
    `,
  ),
  inherit: undefined,
}

type CommonLinkExtras = PressHandlers & {
  isDisabled?: boolean
  isLoading?: boolean
  loadingLabel?: string
}

interface ButtonLikeStyling {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  iconPosition?: IconPosition
}

type NextProps = React.ComponentProps<typeof NextLink>

// `Trans` clones the element it is given in `components` and injects the sentence's parsed inner
// content as children, so a plain (non-button) `Link` written as `<Link href="…" />` never actually
// renders without children — but next/link's own type requires them. Widen just this variant so
// that call site type-checks.
type NextPropsOptionalChildren = Omit<NextProps, "children"> & { children?: React.ReactNode }

type LinkPlainProps = NextPropsOptionalChildren &
  CommonLinkExtras & {
    styledAsButton?: false | undefined
    appearance?: LinkAppearance
  }

type LinkButtonProps = NextProps &
  CommonLinkExtras &
  ButtonLikeStyling & {
    styledAsButton: true
  }

export type LinkProps = LinkPlainProps | LinkButtonProps

const DEFAULT_APPEARANCE: LinkAppearance = "text"

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  function Link(props, forwardedRef) {
    const {
      styledAsButton,
      appearance,
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
      className,
      children,
      tabIndex,
      ...rest
    } = props as LinkProps & ButtonLikeStyling & { appearance?: LinkAppearance }

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

    const rootClassName =
      cx(
        styledAsButtonResolved
          ? resolveButtonRootCss({
              size: (styledAsButtonResolved ? size : undefined) ?? "medium",
              variant: (styledAsButtonResolved ? variant : undefined) ?? "primary",
            })
          : plainLinkCss[appearance ?? DEFAULT_APPEARANCE],
        className,
      ) || undefined

    const resolvedIcon = styledAsButtonResolved ? icon : undefined
    // oxlint-disable-next-line i18next/no-literal-string
    const defaultIconPosition: IconPosition = "start"
    const resolvedIconPosition =
      (styledAsButtonResolved ? iconPosition : undefined) ?? defaultIconPosition

    const mergedLinkProps = mergeProps(linkProps, {
      onClick: isInteractivelyDisabled ? undefined : onClick,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
    })

    return (
      <NextLink
        {...(mergedLinkProps as Partial<NextProps>)}
        {...rest}
        ref={ref}
        className={rootClassName}
        data-pressed={isPressed ? "true" : "false"}
        data-disabled-reason={
          isLoading ? "loading" : isInteractivelyDisabled ? "disabled" : undefined
        }
        // oxlint-disable-next-line i18next/no-literal-string
        aria-busy={isLoading ? "true" : undefined}
        tabIndex={finalTabIndex}
      >
        {styledAsButtonResolved ? (
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
                  <span className={spinnerCss} />
                </span>
                <VisuallyHidden id={loadingDescId}>{loadingLabel}</VisuallyHidden>
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

/**
 * `Link`, named for use as a `<Trans>` substitution component:
 * `<Trans components={{ a: <TransLink href="…" /> }}>...</Trans>`. `Trans` clones the element and
 * supplies the sentence's own text as children, which is why none are passed here.
 */
export const TransLink = Link
