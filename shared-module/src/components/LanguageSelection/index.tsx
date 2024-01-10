import { css } from "@emotion/css"
import { Placement } from "@popperjs/core"
import { LanguageTranslation } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import OutsideClickHandler from "react-outside-click-handler"
import { usePopper } from "react-popper"

import { LANGUAGE_COOKIE_KEY } from "../../utils/constants"

import LanguageMenu from "./LanguageMenu"
import LanguageOption from "./LanguageOption"

export interface LanguageOption {
  tag: string
  name: string
}

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { tag: "en-US", name: "English" },
  { tag: "fi-FI", name: "Suomi" },
]

const ARROW = "arrow"

export interface LanguageSelectionProps {
  placement: Placement
  languages?: LanguageOption[]
  handleLanguageChange?: (newLanguage: string) => void
}

const LanguageSelection: React.FC<LanguageSelectionProps> = ({
  placement,
  languages,
  handleLanguageChange,
}) => {
  const [visible, setVisible] = useState<boolean>(false)
  const [referenceElement, setReferenceElement] = useState<Element | null>(null)
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null)
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null)
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement,
    modifiers: [{ name: ARROW, options: { element: arrowElement } }],
  })
  const { i18n, t } = useTranslation()

  const defaultHandleLanguageChange = (newLanguage: string) => {
    i18n.changeLanguage(newLanguage)
    setVisible(false)
    const selectedLanguage = newLanguage.split("-")
    // eslint-disable-next-line i18next/no-literal-string
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${selectedLanguage[0]}; path=/; SameSite=Strict; max-age=31536000;`
  }

  const noLanguagesToChange = (languages ?? DEFAULT_LANGUAGES).length <= 1

  return (
    <>
      <OutsideClickHandler onOutsideClick={() => setVisible(false)}>
        <button
          type="button"
          className={css`
            background: none;
            border: none;
            padding: 0.6rem 1rem;
            margin-bottom: 2px;
            :hover {
              cursor: pointer;
            }

            ${noLanguagesToChange && `cursor: not-allowed !important;`}
          `}
          ref={setReferenceElement}
          onClick={(e) => {
            e.preventDefault()
            setVisible(!visible)
          }}
        >
          <LanguageTranslation
            size={18}
            className={css`
              margin-right: 0.6rem;
            `}
          />
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
            <ul
              className={css`
                padding: 0;
              `}
            >
              {(languages ?? DEFAULT_LANGUAGES).map((x) => (
                <LanguageOption
                  key={x.tag}
                  label={x.name}
                  onClick={() => {
                    if (handleLanguageChange) {
                      handleLanguageChange(x.tag)
                    } else {
                      defaultHandleLanguageChange(x.tag)
                    }
                  }}
                />
              ))}
            </ul>
          </LanguageMenu>
          {/* eslint-disable-next-line react/forbid-dom-props */}
          <div ref={setArrowElement} style={styles.arrow} />
        </div>
      </OutsideClickHandler>
    </>
  )
}

export default LanguageSelection
