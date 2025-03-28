import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import { NewTeacherGradingDecision, TeacherDecisionType } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ArrowDown from "@/shared-module/common/img/caret-arrow-down.svg"
import { primaryFont } from "@/shared-module/common/styles"

interface TeacherGradingDecisionControlsProps {
  userExerciseStateId: string
  exerciseId: string
  exerciseMaxPoints: number
  onGradingDecisionSubmit: (decision: NewTeacherGradingDecision) => void
}

const ControlPanel = styled.div`
  background: #f5f5f5;
  width: 100%;
  height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const CustomPointPopup = css`
  background-color: #e2e4e6;
  padding: 2em;
  z-index: 5;
`

const PLACEMENT = "bottom"
const ARROW = "arrow"

const TeacherGradingDecisionControls: React.FC<TeacherGradingDecisionControlsProps> = ({
  userExerciseStateId,
  exerciseId,
  exerciseMaxPoints,
  onGradingDecisionSubmit,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null)
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null)
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null)

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: PLACEMENT,
    modifiers: [
      { name: ARROW, options: { element: arrowElement, padding: 10 } },
      {
        name: "offset",
        options: {
          offset: [0, 20],
        },
      },
    ],
  })

  const handleDecision = (action: TeacherDecisionType, value?: number | undefined) => {
    const manual_points = value !== undefined ? value : null
    onGradingDecisionSubmit({
      user_exercise_state_id: userExerciseStateId,
      exercise_id: exerciseId,
      action: action,
      manual_points: manual_points,
      justification: null,
      hidden: false,
    })
  }

  const handleSubmitAndClose = () => {
    // eslint-disable-next-line i18next/no-literal-string
    handleDecision("CustomPoints", sliderValue)
    setOpen(false)
  }

  const handleOpenPopup = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault()
    setOpen(!open)
  }

  return (
    <>
      <ControlPanel>
        <div
          className={css`
            margin-left: 1em;
          `}
        >
          <h3
            className={css`
              color: #4b4b4b;
              margin-bottom: 1rem;
            `}
          >
            {t("grading")}
          </h3>
        </div>
        <div
          className={css`
            display: flex;
            align-items: center;
          `}
        >
          <Button
            className={css`
              font-family: ${primaryFont};
              font-weight: 600;
              font-size: 16px;
              margin-left: 1em;
              margin-right: 0.5em;
            `}
            size="medium"
            variant="reject"
            onClick={() =>
              // eslint-disable-next-line i18next/no-literal-string
              handleDecision("ZeroPoints")
            }
          >
            {t("button-text-zero-points")}
          </Button>
          <Button
            size="medium"
            variant="primary"
            className={css`
              margin-right: 0.5em;
            `}
            // eslint-disable-next-line i18next/no-literal-string
            onClick={() => handleDecision("FullPoints")}
          >
            {t("button-text-full-points")}
          </Button>
          <Button
            size="medium"
            variant="white"
            type="button"
            id="custom-point-button-v2"
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
        </div>
      </ControlPanel>
      {open ? (
        <div
          id="custom-point-popup"
          ref={setPopperElement}
          className={cx(CustomPointPopup)}
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
                onChange={(event) => setSliderValue(Number(event.target.value))}
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
              onChange={(event) => setSliderValue(Number(event.target.value))}
              min="0.0"
              step={0.1}
              max={exerciseMaxPoints}
              type="number"
              aria-labelledby="input-slider"
            />
          </div>
          <div>
            <Button
              type="button"
              variant="white"
              size="medium"
              onClick={(e) => {
                e.preventDefault()
                setOpen(!open)
              }}
            >
              {t("button-text-cancel")}
            </Button>
            <Button
              size="medium"
              variant="primary"
              disabled={
                sliderValue > exerciseMaxPoints ||
                sliderValue < 0 ||
                sliderValue.toString().length > exerciseMaxPoints.toString().length + 4
              }
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

export default TeacherGradingDecisionControls
