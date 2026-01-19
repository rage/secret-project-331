"use client"

import { css } from "@emotion/css"
import React, { useRef } from "react"
import { useTabPanel } from "react-aria"

import { useTabsContext } from "./Tabs"

interface TabPanelProps {
  children: React.ReactNode
}

const TabPanel: React.FC<TabPanelProps> = ({ children }) => {
  const { state } = useTabsContext()
  const tabPanelRef = useRef<HTMLDivElement>(null)

  const { tabPanelProps } = useTabPanel({}, state, tabPanelRef)

  return (
    <div
      {...tabPanelProps}
      ref={tabPanelRef}
      className={css`
        outline: none;
      `}
    >
      {children}
    </div>
  )
}

export default TabPanel
