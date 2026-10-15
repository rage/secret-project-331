"use client"

import { css } from "@emotion/css"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Button } from "@/shared-module/components"

import PointsBreakdownDialog, { type PointsBreakdownScope } from "./PointsBreakdownDialog"
import type { ProgressMeasure } from "./progressText"

/** Opens the list of every exercise in one module, with the module's totals in its header. */
const PointsBreakdownButton: React.FC<{
  scope: PointsBreakdownScope
  points: ProgressMeasure
  exercises: ProgressMeasure
}> = ({ scope, points, exercises }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className={triggerCss}>
      <Button
        variant="tertiary"
        size="medium"
        className={buttonCss}
        domProps={{ "aria-haspopup": OPENS_A_DIALOG }}
        onPress={() => setIsOpen(true)}
      >
        {t("button-show-all-exercises-in-course")}
      </Button>
      <PointsBreakdownDialog
        scope={scope}
        points={points}
        exercises={exercises}
        open={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  )
}

export default PointsBreakdownButton

const OPENS_A_DIALOG = "dialog" as const

const triggerCss = css`
  --btn-tertiary-bg: var(--color-clear-50);
  --btn-tertiary-fg: var(--color-green-700);
  --btn-tertiary-border: var(--color-green-600);
  --btn-tertiary-bg-hover: var(--color-green-700);
  --btn-tertiary-fg-hover: var(--color-clear-50);
  --btn-tertiary-border-hover: var(--color-green-700);
  --btn-tertiary-bg-pressed: var(--color-green-800);

  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
`

// The card's side padding leaves a phone too narrow for the label on one line.
const buttonCss = css`
  width: 100%;
  height: auto;
  min-height: var(--control-height-md);
  padding-block: 0.5rem;
  white-space: normal;
  line-height: 1.25;

  ${respondToOrLarger.sm} {
    width: auto;
  }
`
