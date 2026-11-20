"use client"

import { css } from "@emotion/css"
import { Plus } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

import { ICON_SIZE_BUTTON } from "./designFormStyles"

const rowStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
`

const limitStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
`

/** Add button of a Design form list, disabled with an explanation once the list is full. */
export default function AddListItemButton(props: {
  label: string
  itemCount: number
  maxItems: number
  onAdd: () => void
  variant?: "secondary" | "tertiary"
}) {
  const { label, itemCount, maxItems, onAdd, variant = "tertiary" } = props
  const { t } = useTranslation()
  const isFull = itemCount >= maxItems
  return (
    <div className={rowStyles}>
      <Button
        type="button"
        variant={variant}
        size="small"
        icon={<Plus size={ICON_SIZE_BUTTON} />}
        onClick={onAdd}
        disabled={isFull}
      >
        {label}
      </Button>
      {isFull ? (
        <p className={limitStyles}>{t("course-plans-design-list-full", { max: maxItems })}</p>
      ) : null}
    </div>
  )
}
