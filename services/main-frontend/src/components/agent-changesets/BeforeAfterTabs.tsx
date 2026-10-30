"use client"

import { css, cx } from "@emotion/css"
import { Item } from "@react-stately/collections"
import { useTabListState, type TabListState } from "@react-stately/tabs"
import React, { useRef } from "react"
import { mergeProps, useFocusRing, useHover, useTab, useTabPanel } from "react-aria"
import { useTranslation } from "react-i18next"

import { tabPillCss, TabStrip } from "@/components/Tabs/tabStrip"
import { baseTheme } from "@/shared-module/common/styles"

const ORIENTATION = "horizontal"
const BEFORE = "before"
const AFTER = "after"

const panelCss = css`
  min-width: 0;
  border: 1px solid ${baseTheme.colors.gray[100]};
  border-radius: 8px;
  padding: 1rem;
  background: ${baseTheme.colors.clear[100]};
  overflow: hidden;
`

const stripCss = css`
  margin-bottom: 0.75rem;
`

const BeforeAfterTab: React.FC<{
  item: { key: string | number | bigint | symbol; rendered: React.ReactNode }
  state: TabListState<object>
}> = ({ item, state }) => {
  const ref = useRef<HTMLDivElement>(null)
  const { tabProps, isSelected } = useTab({ key: item.key as string }, state, ref)
  const { focusProps, isFocusVisible } = useFocusRing()
  const { hoverProps, isHovered } = useHover({})
  return (
    <div
      {...mergeProps(tabProps, focusProps, hoverProps)}
      ref={ref}
      className={cx(
        tabPillCss({ isSelected, isFocusVisible, isHovered }),
        css`
          font-size: 0.9375rem;
          padding: 0.5rem 1.25rem;
        `,
      )}
    >
      {item.rendered}
    </div>
  )
}

interface BeforeAfterTabsProps {
  /** Left out when there was nothing before, as for a created entity. */
  before?: React.ReactNode
  /** Left out when there is nothing after, as for a deleted entity. */
  after?: React.ReactNode
  "data-testid-prefix": string
}

/**
 * Content before and after a change as full-width tabs, After first. Only the selected tab's
 * content is rendered, since each side can be a whole course page.
 */
const BeforeAfterTabs: React.FC<BeforeAfterTabsProps> = ({
  before,
  after,
  "data-testid-prefix": testIdPrefix,
}) => {
  const { t } = useTranslation()
  const hasBefore = before !== undefined && before !== null
  const hasAfter = after !== undefined && after !== null
  const tabs = [
    ...(hasBefore ? [{ key: BEFORE, label: t("agent-before"), content: before }] : []),
    ...(hasAfter ? [{ key: AFTER, label: t("agent-after"), content: after }] : []),
  ]
  const state = useTabListState({
    defaultSelectedKey: hasAfter ? AFTER : BEFORE,
    items: tabs,
    children: (tab) => (
      <Item key={tab.key} textValue={tab.label}>
        {tab.label}
      </Item>
    ),
  }) as TabListState<object>
  const panelRef = useRef<HTMLDivElement>(null)
  const { tabPanelProps } = useTabPanel({}, state, panelRef)
  const selected = tabs.find((tab) => tab.key === state.selectedKey) ?? tabs[0]

  if (selected === undefined) {
    return null
  }
  return (
    <div>
      {tabs.length > 1 && (
        <TabStrip state={state} orientation={ORIENTATION} className={stripCss}>
          {[...state.collection].map((item) => (
            <BeforeAfterTab key={item.key} item={item} state={state} />
          ))}
        </TabStrip>
      )}
      <div
        {...tabPanelProps}
        ref={panelRef}
        className={panelCss}
        data-testid={`${testIdPrefix}-${selected.key}`}
      >
        {selected.content}
      </div>
    </div>
  )
}

export default BeforeAfterTabs
