import { css } from "@emotion/css"
import { Placement } from "@popperjs/core"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import LanguageMenu from "./LanguageMenu"
import LanguageOption from "./LanguageOption"

const ARROW = "arrow"
const EN = "en"
const ENGLISH = "English"
const FI = "fi"
const SUOMI = "Suomi"

export interface LanguageSelectionProps {
  placement: Placement
}

const LanguageSelection: React.FC<LanguageSelectionProps> = ({ placement }) => {
  const [visible, setVisible] = useState(false)
  const [referenceElement, setReferenceElement] = useState<Element | null>(null)
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null)
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null)
  const { styles: popperStyles, attributes } = usePopper(referenceElement, popperElement, {
    placement,
    modifiers: [{ name: ARROW, options: { element: arrowElement } }],
  })
  const { i18n, t } = useTranslation()

  const handleLanguageChange = (newLanguage: string) => {
    i18n.changeLanguage(newLanguage)
    setVisible(false)
  }

  return (
    <>
      <button type="button" ref={setReferenceElement} onClick={() => setVisible(!visible)}>
        {t("choose-a-language")}
      </button>
      {/* eslint-disable-next-line react/forbid-dom-props */}
      <div ref={setPopperElement} style={popperStyles.popper} {...attributes.popper}>
        <LanguageMenu visible={visible}>
          <ul
            className={css`
              padding: 0;
            `}
          >
            <LanguageOption label={ENGLISH} onClick={() => handleLanguageChange(EN)} />
            <LanguageOption label={SUOMI} onClick={() => handleLanguageChange(FI)} />
          </ul>
        </LanguageMenu>
        {/* eslint-disable-next-line react/forbid-dom-props */}
        <div ref={setArrowElement} style={popperStyles.arrow} />
      </div>
    </>
  )
}

export default LanguageSelection
