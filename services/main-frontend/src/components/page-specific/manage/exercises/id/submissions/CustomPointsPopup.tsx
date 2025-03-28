import { css, cx } from "@emotion/css"
import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import Button from "@/shared-module/common/components/Button"
import ArrowDown from "@/shared-module/common/img/caret-arrow-down.svg"

interface CustomPointsPopupProps {
  exerciseMaxPoints: number
  onSubmit: (points: number) => void
}

const CustomPointsPopup: React.FC<CustomPointsPopupProps> = ({ exerciseMaxPoints, onSubmit }) => {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [sliderValue, setSliderValue] = React.useState<number>(0)
  const [referenceElement, setReferenceElement] = React.useState<HTMLButtonElement | null>(null)
  const [popperElement, setPopperElement] = React.useState<HTMLElement | null>(null)
  const [arrowElement, setArrowElement] = React.useState<HTMLElement | null>(null)

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "bottom",
    modifiers: [
      { name: "arrow", options: { element: arrowElement, padding: 10 } },
      {
        name: "offset",
        options: {
          offset: [0, 20],
        },
      },
    ],
  })

  const handleSubmitAndClose = useCallback(() => {
    onSubmit(sliderValue)
    setOpen(false)
  }, [onSubmit, sliderValue])

  const handleOpenPopup = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault()
      setOpen(!open)
    },
    [open],
  )

  const handleSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(event.target.value))
  }, [])

  const handleNumberInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(event.target.value))
  }, [])

  const handleCancel = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault()
      setOpen(!open)
    },
    [open],
  )

  const isSubmitDisabled =
    sliderValue > exerciseMaxPoints ||
    sliderValue < 0 ||
    // Limit to 2 decimal places
    !Number.isInteger(sliderValue * 100)

  return (
    <>
      <Button
        size="medium"
        variant="white"
        type="button"
        ref={setReferenceElement}
        onClick={handleOpenPopup}
      >
        {t("button-text-custom-points")}
        <ArrowDown
          className={css`
            transform: scale(1.2);
            margin-left: 0.6em;
            margin-bottom: 4px;
          `}
        />
      </Button>
      {open ? (
        <div
          id="custom-point-popup"
          ref={setPopperElement}
          className={css`
            background-color: #e2e4e6;
            padding: 2em;
            z-index: 5;
          `}
          // eslint-disable-next-line react/forbid-dom-props
          style={styles.popper}
          {...attributes.popper}
        >
          {/* eslint-disable-next-line react/forbid-dom-props */}
          <div id="arrow" ref={setArrowElement} style={styles.arrow} />
          <div
            className={css`
              display: flex;
              flex-direction: row;
              margin-bottom: 1em;
              justify-content: space-evenly;
            `}
          >
            <div
              className={css`
                width: 100%;
                padding: 13px 0;
                align-self: stretch;
              `}
            >
              <input
                className={css`
                  height: 4px;
                  width: 100%;
                `}
                type="range"
                min="0"
                max={exerciseMaxPoints}
                step={0.1}
                value={typeof sliderValue === "number" ? sliderValue : 0.0}
                onChange={handleSliderChange}
                aria-labelledby="input-slider"
              />
            </div>

            <input
              className={css`
                margin-left: 1.5em;
                max-width: 4em;
                background: none;
                border: 0px;
                border-bottom: 1px solid black;
                text-align: right;
              `}
              value={sliderValue}
              onChange={handleNumberInputChange}
              min="0.0"
              step={0.1}
              max={exerciseMaxPoints}
              type="number"
              aria-labelledby="input-slider"
            />
          </div>
          <div>
            <Button type="button" variant="white" size="medium" onClick={handleCancel}>
              {t("button-text-cancel")}
            </Button>
            <Button
              size="medium"
              variant="primary"
              disabled={isSubmitDisabled}
              onClick={handleSubmitAndClose}
            >
              {t("button-text-give-custom-points")}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default CustomPointsPopup
