import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { faAngleDown, faCircleExclamation } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Input, Slider } from "@mui/material"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

import { updateAnswerRequiringAttention } from "../../../../../../services/backend/answers-requiring-attention"
import {
  AnswerRequiringAttentionWithTasks,
  TeacherDecisionType,
} from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import { primaryFont } from "../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"
import SubmissionIFrame from "../../../../submissions/id/SubmissionIFrame"

interface Props {
  answersRequiringAttention: AnswerRequiringAttentionWithTasks[]
  exercise_max_points: number
}

const Layout = styled.div`
  max-width: 48rem;
  margin: auto;
  padding-bottom: 20em;
`
const StyledIconDark = styled(FontAwesomeIcon)`
  font-size: 4rem;
  color: white;
  margin: 1.5rem;
`

const AnswerLayout = styled.div`
  ${respondToOrLarger.sm} {
    width: 100%;
  }
`

const StatusPanel = styled.div`
  border-top: 3px solid rgba(112, 112, 112, 0.1);
  width: 100%;
  height: 70px;
  display: flex;
  align-items: center;
`

const CustomPointPopup = css`
  background-color: #e2e4e6;
  padding: 2em;
`

const TopBar = styled.div`
  width: 100%;
  height: 108px;
  background: #1f6964;
  display: flex;
  align-items: center;
`

const ControlPanel = styled.div`
  background: #f5f5f5;
  width: 100%;
  height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const AnswersRequiringAttentionList: React.FC<Props> = ({
  answersRequiringAttention,
  exercise_max_points,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null)
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null)
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null)
  const PLACEMENT = "bottom"

  const ARROW = "arrow"

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: PLACEMENT,
    modifiers: [
      { name: ARROW, options: { element: arrowElement, padding: 10 } },
      {
        // eslint-disable-next-line i18next/no-literal-string
        name: "offset",
        options: {
          offset: [0, 20],
        },
      },
    ],
  })

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    if (typeof newValue === "number") {
      setSliderValue(newValue)
    }
  }
  if (answersRequiringAttention.length === 0) {
    return <div>{t("no-answers-requiring-attention")}</div>
  }

  const handleInputFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(event.target.value))
  }

  const handleControlPanel = async (
    user_exercise_state_id: string,
    exercise_id: string,
    action: TeacherDecisionType,
    value?: number | undefined,
  ) => {
    const manual_points = value !== undefined ? value : null
    updateAnswerRequiringAttention({
      user_exercise_state_id,
      exercise_id,
      // eslint-disable-next-line i18next/no-literal-string
      action: action,
      manual_points: manual_points,
    })
  }

  const handleSubmitAndClose = (user_exercise_state_id: string, exercise_id: string) => {
    handleControlPanel(
      user_exercise_state_id,
      exercise_id,
      // eslint-disable-next-line i18next/no-literal-string
      "CustomPoints",
      sliderValue,
    )
    setOpen(false)
  }

  const handleOpenPopup = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault()
    setOpen(!open)
  }

  return (
    <>
      <Layout>
        {answersRequiringAttention.map((answerRequiringAttention) => (
          <AnswerLayout key={answerRequiringAttention.id}>
            <TopBar>
              <StyledIconDark icon={faCircleExclamation} />
              <div id="text-column">
                <p
                  className={css`
                    font-family: ${primaryFont};
                    color: #f5f6f7cc;
                    font-size: 16px;
                    font-weight: 500;
                    line-height: 16px;
                    letter-spacing: 0em;
                    margin-bottom: 0.5em;
                  `}
                >
                  {t("answered-at", {
                    time: `${answerRequiringAttention?.created_at.toDateString()} ${answerRequiringAttention?.created_at.toLocaleTimeString()}`,
                  })}{" "}
                </p>
                <p
                  className={css`
                    font-family: ${primaryFont};
                    font-size: 17px;
                    font-weight: 400;
                    line-height: 17px;
                    letter-spacing: 0em;
                    text-align: left;
                    color: white;
                  `}
                >
                  {" "}
                  {t("user-id")}: {answerRequiringAttention?.user_id}
                </p>
              </div>
              <div
                className={css`
                  color: white;
                  margin-left: auto;
                  margin-right: 1em;
                  font-size: 24px;
                `}
                id="point column"
              >
                {/* eslint-disable-next-line i18next/no-literal-string*/}
                <p>
                  POINT: {answerRequiringAttention.score_given}/{exercise_max_points}
                </p>
                {}
              </div>
            </TopBar>
            <p
              className={css`
                margin-top: 1.5em;
                margin-bottom: 1em;
                font-family: ${primaryFont};
                color: #4b4b4b;
                font-weight: 500;
                font-size: 20px;
                line-height: 20px;
              `}
            >
              {t("student-answer")}
            </p>

            {answerRequiringAttention.tasks
              .sort((a, b) => a.order_number - b.order_number)
              .map((task) => (
                <SubmissionIFrame
                  key={task.id}
                  url={`${task.exercise_iframe_url}?width=700`} // todo: move constants to shared module?
                  public_spec={task.public_spec}
                  submission={task.previous_submission}
                  model_solution_spec={task.model_solution_spec}
                  grading={task.previous_submission_grading}
                />
              ))}

            <div>
              <StatusPanel>
                <div>
                  <span
                    className={css`
                      margin-left: 1em;
                      font-family: ${primaryFont};
                      color: #707070;
                    `}
                  >
                    {t("status")}
                  </span>
                  <span
                    className={css`
                      margin-left: 1em;
                      font-family: ${primaryFont};
                      color: #9a9a9a;
                    `}
                  >
                    {answerRequiringAttention.grading_progress}
                  </span>
                  <span
                    className={css`
                      margin-left: 1em;
                      font-family: ${primaryFont};
                      color: #707070;
                    `}
                  >
                    {t("spam-flag")}
                  </span>
                  <span
                    className={css`
                      margin-left: 1em;
                      font-family: ${primaryFont};
                      color: #9a9a9a;
                    `}
                    // eslint-disable-next-line i18next/no-literal-string
                  >
                    enough
                  </span>
                </div>
              </StatusPanel>
              <ControlPanel>
                <div
                  className={css`
                    margin-left: 1em;
                  `}
                >
                  <h3
                    className={css`
                      color: #4b4b4b;
                    `}
                  >
                    {" "}
                    {t("grading")}
                  </h3>
                  <p
                    className={css`
                      color: #4b4b4b;
                      margin-bottom: 0.5em;
                    `}
                  >
                    {" "}
                    {t("grading-description")}
                  </p>
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
                      handleControlPanel(
                        answerRequiringAttention.id,
                        answerRequiringAttention.exercise_id,
                        // eslint-disable-next-line i18next/no-literal-string
                        "ZeroPoints",
                      )
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
                    onClick={() =>
                      handleControlPanel(
                        answerRequiringAttention.id,
                        answerRequiringAttention.exercise_id,
                        // eslint-disable-next-line i18next/no-literal-string
                        "FullPoints",
                      )
                    }
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
                    <FontAwesomeIcon
                      className={css`
                        margin-left: 0.5em;
                      `}
                      id="fa-angle-down"
                      icon={faAngleDown}
                    />
                  </Button>
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
                        `}
                      >
                        <Slider
                          value={typeof sliderValue === "number" ? sliderValue : 0.0}
                          step={0.1}
                          min={0.0}
                          max={exercise_max_points}
                          onChange={handleSliderChange}
                          aria-labelledby="input-slider"
                        />
                        <Input
                          className={css`
                            margin-left: 1.5em;
                            max-width: 4em;
                          `}
                          value={sliderValue}
                          size="small"
                          onChange={handleInputFieldChange}
                          inputProps={{
                            step: 0.1,
                            min: 0.0,
                            max: exercise_max_points,
                            type: "number",
                            // eslint-disable-next-line i18next/no-literal-string
                            "aria-labelledby": "input-slider",
                          }}
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
                            sliderValue > exercise_max_points ||
                            sliderValue < 0 ||
                            sliderValue.toString().length >
                              exercise_max_points.toString().length + 4
                          }
                          onClick={() =>
                            handleSubmitAndClose(
                              answerRequiringAttention.id,
                              answerRequiringAttention.exercise_id,
                            )
                          }
                        >
                          {t("button-text-give-custom-points")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </ControlPanel>
            </div>
          </AnswerLayout>
        ))}
      </Layout>
      <DebugModal data={answersRequiringAttention}></DebugModal>
    </>
  )
}

export default AnswersRequiringAttentionList
