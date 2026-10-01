"use client"

import { css } from "@emotion/css"
import { LayoutVertical } from "@vectopus/atlas-icons-react"
import React, { useRef } from "react"
import { useButton } from "react-aria"
import type { OverlayTriggerState } from "react-aria-components"
import { useTranslation } from "react-i18next"

interface SidebarButtonProps {
  state: OverlayTriggerState
}

const sidebarButtonCss = css`
  background: none;
  border: none;
  box-shadow: none;
  text-shadow: none;
  padding: 12px 16px;
`

export const SidebarButton: React.FC<SidebarButtonProps> = ({ state }) => {
  const { t } = useTranslation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { buttonProps } = useButton(
    {
      onPress: state.open,
      "aria-label": t("open-menu"),
      "aria-expanded": state.isOpen,
    },
    buttonRef,
  )

  return (
    <button {...buttonProps} ref={buttonRef} className={sidebarButtonCss}>
      <LayoutVertical weight="medium" size={16} />
    </button>
  )
}
