"use client"

import { css, cx } from "@emotion/css"
import type { useTabListState } from "@react-stately/tabs"
import { useRef } from "react"
import { useFocusRing, useTab } from "react-aria"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

import {
  MOOC_DESIGN_TAB,
  stagePillSelectedStyles,
  stagePillStyles,
  tabBandBaseStyles,
  tabBandFocusRingStyles,
  tabBandSelectedStyles,
  tabBandUnselectedStyles,
} from "./stageTimelineShared"

const ACCENT = baseTheme.colors.green[600]

const bandStyles = css`
  justify-content: flex-end;
  min-width: 8.5rem;
`

const hintStyles = css`
  font-size: 0.75rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.35;
`

const pillStyles = css`
  border-color: ${ACCENT};
  color: ${ACCENT};
`

/** The "MOOC design" overview tab at the start of the workspace timeline strip. */
export default function MoocDesignTab(props: {
  state: ReturnType<typeof useTabListState>
  onSelect: () => void
}) {
  const { state, onSelect } = props
  const { t } = useTranslation()
  const ref = useRef<HTMLButtonElement | null>(null)
  const { tabProps } = useTab({ key: MOOC_DESIGN_TAB }, state, ref)
  const { isFocusVisible, focusProps } = useFocusRing()
  const isSelected = state.selectedKey === MOOC_DESIGN_TAB

  return (
    <button
      {...tabProps}
      {...focusProps}
      ref={ref}
      type="button"
      onClick={(event) => {
        tabProps.onClick?.(event)
        if (!event.defaultPrevented) {
          onSelect()
        }
      }}
      className={cx(
        tabBandBaseStyles,
        bandStyles,
        !isSelected && tabBandUnselectedStyles,
        isSelected && tabBandSelectedStyles(ACCENT),
        isFocusVisible && tabBandFocusRingStyles,
      )}
    >
      <span className={hintStyles}>{t("course-plans-mooc-design-tab-hint")}</span>
      <span
        className={cx(stagePillStyles, pillStyles, isSelected && stagePillSelectedStyles(ACCENT))}
      >
        {t("course-plans-mooc-design-tab")}
      </span>
    </button>
  )
}
