"use client"

import { css } from "@emotion/css"
import { LayoutVertical } from "@vectopus/atlas-icons-react"
import React, { useRef } from "react"
import { useButton } from "react-aria"
import type { OverlayTriggerState } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface DisclosureButtonProps {
  state: OverlayTriggerState
}

const disclosureButton = css`
  background: none;
  border: none;
  box-shadow: none;
  text-shadow: none;
  padding: 0 12px;
  padding-bottom: 12px;

  ${respondToOrLarger.md} {
    display: none;
  }
`

export const DisclosureButton: React.FC<DisclosureButtonProps> = ({ state }) => {
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
    <button {...buttonProps} ref={buttonRef} className={disclosureButton}>
      <LayoutVertical weight="medium" size={16} />
    </button>
  )
}
