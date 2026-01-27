"use client"

import React from "react"

type NavigateEvent = {
  preventDefault: () => void
}

type NextLinkMockProps = {
  href: string | URL
  children?: React.ReactNode
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  locale?: string | false
  legacyBehavior?: boolean
  onNavigate?: (event: NavigateEvent) => void
  as?: string | URL
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">

function hrefToString(href: string | URL): string {
  return typeof href === "string" ? href : href.toString()
}

const NextLink = React.forwardRef<HTMLAnchorElement, NextLinkMockProps>(function NextLink(
  { href, children, ...rest },
  ref,
) {
  return (
    <a ref={ref} href={hrefToString(href)} {...rest}>
      {children}
    </a>
  )
})

export default NextLink
