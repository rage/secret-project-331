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
const CHANGES = "changes"
const BEFORE = "before"
const AFTER = "after"

/**
 * CSS custom property with the height of whatever the review page keeps stuck to the top of the
 * viewport, so the tab strip sticks below it. Set by the page; 0 when unset.
 */
export const STICKY_TOP_PROPERTY = "--agent-review-sticky-top"

const panelCss = css`
  min-width: 0;
  border: 1px solid ${baseTheme.colors.gray[100]};
  border-radius: 8px;
  padding: 1rem;
  background: ${baseTheme.colors.clear[100]};
  overflow: hidden;
`

const stripCss = css`
  position: sticky;
  top: var(${STICKY_TOP_PROPERTY}, 0px);
  z-index: 5;
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
  /** What changed, both sides marked in one view; shown first when given. */
  changes?: React.ReactNode
  /** Left out when there was nothing before, as for a created entity. */
  before?: React.ReactNode
  /** Left out when there is nothing after, as for a deleted entity. */
  after?: React.ReactNode
  "data-testid-prefix": string
}

/**
 * Content of a change as full-width tabs: Changes, Before and After, opening on Changes, or on
 * After without it. Only the selected tab's content is rendered, since each can be a whole page.
 * The strip sticks to the top while its content scrolls past.
 */
const BeforeAfterTabs: React.FC<BeforeAfterTabsProps> = ({
  changes,
  before,
  after,
  "data-testid-prefix": testIdPrefix,
}) => {
  const { t } = useTranslation()
  const hasChanges = changes !== undefined && changes !== null
  const hasBefore = before !== undefined && before !== null
  const hasAfter = after !== undefined && after !== null
  const tabs = [
    ...(hasChanges ? [{ key: CHANGES, label: t("agent-changes-tab"), content: changes }] : []),
    ...(hasBefore ? [{ key: BEFORE, label: t("agent-before"), content: before }] : []),
    ...(hasAfter ? [{ key: AFTER, label: t("agent-after"), content: after }] : []),
  ]
  const state = useTabListState({
    defaultSelectedKey: hasChanges ? CHANGES : hasAfter ? AFTER : BEFORE,
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
