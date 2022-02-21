import { useRouter } from "next/router"
import React, { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import useQueryParameter from "../shared-module/hooks/useQueryParameter"

import { TabProps } from "./Tab"

interface Tabs {
  orientation?: "horizontal" | "vertical"
  disableRouting?: boolean
}

const Tabs: React.FC<Tabs> = ({ children, orientation = "horizontal", disableRouting = false }) => {
  const tabsRef = useRef<HTMLDivElement>(null)
  const path = `${useQueryParameter("path")}`
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    const childElementUrlProps = React.Children.map(children, (child) => {
      if (React.isValidElement<TabProps>(child)) {
        if (typeof child.props.url === "string") {
          return child.props.url
        }
      }
    })
    // Ensure we redirect to the first tab URL if on root or unknown path
    if (
      childElementUrlProps &&
      childElementUrlProps.length !== 0 &&
      !disableRouting &&
      !childElementUrlProps.includes(path)
    ) {
      const urlObject = {
        // Ensure that router.route has the [...path] defined
        // eslint-disable-next-line i18next/no-literal-string
        pathname: path ? router.route : `${router.route}/[...path]`,
        query: { ...router.query, path: childElementUrlProps[0].split("/") },
      }
      router.push(urlObject)
    }
  })

  /**
   * Handle Aria keyboard events for tablist role
   * @param event User keyboard event
   */
  const tabListOnKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // eslint-disable-next-line i18next/no-literal-string
    const previousSiblingKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp"
    // eslint-disable-next-line i18next/no-literal-string
    const nextSiblingKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown"
    if (event.key === previousSiblingKey) {
      event.preventDefault()
      if (document.activeElement?.previousElementSibling instanceof HTMLAnchorElement) {
        document.activeElement.previousElementSibling.focus()
      } else {
        // We at the start of tab nav, go to last
        if (event.currentTarget.lastElementChild instanceof HTMLAnchorElement) {
          event.currentTarget.lastElementChild.focus()
        }
      }
    }
    if (event.key === nextSiblingKey) {
      event.preventDefault()
      if (document.activeElement?.nextElementSibling instanceof HTMLAnchorElement) {
        document.activeElement.nextElementSibling.focus()
      } else {
        // We at the end of tab nav, go to first
        if (event.currentTarget.firstElementChild instanceof HTMLAnchorElement) {
          event.currentTarget.firstElementChild.focus()
        }
      }
    }
    if (event.key === "Home") {
      event.preventDefault()
      if (event.currentTarget.firstElementChild instanceof HTMLAnchorElement) {
        event.currentTarget.firstElementChild.focus()
      }
    }
    if (event.key === "End") {
      event.preventDefault()
      if (event.currentTarget.lastElementChild instanceof HTMLAnchorElement) {
        event.currentTarget.lastElementChild.focus()
      }
    }
    if (event.key === " ") {
      event.preventDefault()
      if (event.target instanceof HTMLAnchorElement) {
        event.target.click()
      }
    }
  }

  return (
    // Interactive support is done in children
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      ref={tabsRef}
      role="tablist"
      aria-label={t("tab-aria-label-default")}
      onKeyDown={tabListOnKeyDown}
    >
      {React.Children.map(children, (child, i) => {
        if (React.isValidElement<TabProps>(child)) {
          // Ensure that one of the elements has tabindex set, if path is empty string,
          return React.cloneElement(child, {
            ...child.props,
            isActive: path ? child.props.isActive : i === 0,
          })
        } else {
          return child
        }
      })}
    </div>
  )
}

export default Tabs
