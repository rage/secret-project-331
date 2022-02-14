import Link from "next/link"
import { UrlObject } from "node:url"
import React from "react"

interface Tabs {
  title: string
  url: UrlObject
  isActive: boolean
}

interface TabNavigationProps {
  tabs: Tabs[]
}

// TODO: Aria (https://www.w3.org/TR/wai-aria-practices/examples/tabs/tabs-2/tabs.html) &
// (https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tab_role)
// TODO: Mobile first css with flex

const TabNavigation: React.FC<TabNavigationProps> = ({ tabs }) => {
  return (
    <div>
      {tabs.map((tab) => {
        console.log(tab.title, tab.isActive)
        return (
          <Link key={tab.title} href={tab.url}>
            {tab.title}
          </Link>
        )
      })}
    </div>
  )
}

export default TabNavigation
