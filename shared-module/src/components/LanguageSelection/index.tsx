import { css } from "@emotion/css"
import { faGlobe } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Placement } from "@popperjs/core"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import OutsideClickHandler from "react-outside-click-handler"
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
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
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
      <button
        type="button"
        className={css`
          background: none;
          border: none;
          padding: 0.5rem 1rem;

          :hover {
            cursor: pointer;
          }
        `}
        ref={setReferenceElement}
        onClick={() => setVisible(!visible)}
      >
        <FontAwesomeIcon
          className={css`
            margin-right: 0.5rem;
          `}
          icon={faGlobe}
        />{" "}
        {t("language")}
      </button>
      <div
        className={css`
          z-index: 800;
        `}
        ref={setPopperElement}
        // eslint-disable-next-line react/forbid-dom-props
        style={styles.popper}
        {...attributes.popper}
      >
        <LanguageMenu visible={visible}>
          <OutsideClickHandler onOutsideClick={() => setVisible(false)}>
            <ul
              className={css`
                padding: 0;
              `}
            >
              <LanguageOption label={ENGLISH} onClick={() => handleLanguageChange(EN)} />
              <LanguageOption label={SUOMI} onClick={() => handleLanguageChange(FI)} />
            </ul>
          </OutsideClickHandler>
        </LanguageMenu>
        {/* eslint-disable-next-line react/forbid-dom-props */}
        <div ref={setArrowElement} style={styles.arrow} />
      </div>
    </>
  )
}

export default LanguageSelection
