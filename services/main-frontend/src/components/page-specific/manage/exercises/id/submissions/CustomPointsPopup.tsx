import { css } from "@emotion/css"
import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import Button from "@/shared-module/common/components/Button"
import ArrowDown from "@/shared-module/common/img/caret-arrow-down.svg"
import { baseTheme } from "@/shared-module/common/styles"

interface CustomPointsPopupProps {
  exerciseMaxPoints: number
  onSubmit: (points: number) => void
  longButtonName?: boolean
}

const CustomPointsPopup: React.FC<CustomPointsPopupProps> = ({
  exerciseMaxPoints,
  onSubmit,
  longButtonName = false,
}) => {
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
      {
        name: "preventOverflow",
        options: {
          padding: 8,
          boundary: "clippingParents",
          altAxis: true,
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
        className={css`
          transition: all 0.2s ease;
          &:hover {
            background-color: ${baseTheme.colors.clear[100]};
          }
        `}
      >
        {longButtonName ? t("button-text-give-custom-points") : t("button-text-custom-points")}
        <ArrowDown
          className={css`
            transform: scale(1.2) ${open ? "rotate(180deg)" : "rotate(0)"};
            margin-left: 0.6rem;
            margin-bottom: 0.25rem;
            transition: transform 0.2s ease;
          `}
        />
      </Button>
      {open ? (
        <div
          id="custom-point-popup"
          ref={setPopperElement}
          className={css`
            background-color: ${baseTheme.colors.primary[100]};
            padding: 1.5rem;
            z-index: 5;
            border-radius: 0.5rem;
            box-shadow: 0 0.25rem 1.25rem ${baseTheme.colors.gray[700]}26;
            min-width: 18.75rem;
            animation: fadeIn 0.2s ease;
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(-0.625rem);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
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
              flex-direction: column;
              gap: 1rem;
            `}
          >
            <div
              className={css`
                display: flex;
                align-items: center;
                gap: 1rem;
              `}
            >
              <div
                className={css`
                  flex: 1;
                  padding: 0.5rem 0;
                `}
              >
                <input
                  className={css`
                    height: 0.375rem;
                    width: 100%;
                    -webkit-appearance: none;
                    background: ${baseTheme.colors.clear[200]};
                    border-radius: 0.1875rem;
                    outline: none;
                    &::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      width: 1.125rem;
                      height: 1.125rem;
                      background: ${baseTheme.colors.blue[500]};
                      border-radius: 50%;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      &:hover {
                        transform: scale(1.1);
                      }
                    }
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
                  width: 5rem;
                  padding: 0.5rem 0.75rem;
                  border: 0.0625rem solid ${baseTheme.colors.clear[200]};
                  border-radius: 0.25rem;
                  font-size: 1rem;
                  text-align: center;
                  transition: all 0.2s ease;
                  &:focus {
                    outline: none;
                    border-color: ${baseTheme.colors.blue[500]};
                    box-shadow: 0 0 0 0.125rem ${baseTheme.colors.blue[500]}33;
                  }
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

            <div
              className={css`
                display: flex;
                justify-content: flex-end;
                gap: 0.8rem;
                margin-top: 0.5rem;
              `}
            >
              <Button
                type="button"
                variant="white"
                size="medium"
                onClick={handleCancel}
                className={css`
                  &:hover {
                    background-color: ${baseTheme.colors.clear[100]};
                  }
                `}
              >
                {t("button-text-cancel")}
              </Button>
              <Button
                size="medium"
                variant="primary"
                disabled={isSubmitDisabled}
                onClick={handleSubmitAndClose}
                className={css`
                  transition: all 0.2s ease;
                  &:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                  }
                  &:hover:not(:disabled) {
                    transform: translateY(-0.0625rem);
                    box-shadow: 0 0.125rem 0.5rem ${baseTheme.colors.gray[700]}1A;
                  }
                `}
              >
                {t("button-text-give-custom-points")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default CustomPointsPopup
