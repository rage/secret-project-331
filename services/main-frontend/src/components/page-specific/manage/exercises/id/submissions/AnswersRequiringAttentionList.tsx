import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"
import { useTranslation } from "react-i18next"

import { updateAnswerRequiringAttention } from "../../../../../../services/backend/answers-requiring-attention"
import { AnswerRequiringAttentionWithTasks } from "../../../../../../shared-module/bindings"
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
  height: 70px;
  display: flex;
  align-items: center;
`

const AnswersRequiringAttentionList: React.FC<Props> = ({
  answersRequiringAttention,
  exercise_max_points,
}) => {
  const { t } = useTranslation()
  if (answersRequiringAttention.length === 0) {
    return <div>{t("no-answers-requiring-attention")}</div>
  }

  const handleAcceptAnswer = async (user_exercise_state_id: string, exercise_id: string) => {
    const res = updateAnswerRequiringAttention({
      user_exercise_state_id,
      exercise_id,
      // eslint-disable-next-line i18next/no-literal-string
      action: "accept",
    })
    console.log(res)
  }

  const handleRejectAnswer = async (user_exercise_state_id: string, exercise_id: string) => {
    const res = updateAnswerRequiringAttention({
      user_exercise_state_id,
      exercise_id,
      // eslint-disable-next-line i18next/no-literal-string
      action: "reject",
    })
    console.log(res)
  }

  const handleFlagAsPlagiarismAnswer = async (
    user_exercise_state_id: string,
    exercise_id: string,
  ) => {
    const res = updateAnswerRequiringAttention({
      user_exercise_state_id,
      exercise_id,
      // eslint-disable-next-line i18next/no-literal-string
      action: "flag-as-plagiarism",
    })
    console.log(res)
  }

  console.log(answersRequiringAttention)
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
                  <h3> {t("grading")}</h3>
                </div>
              </StatusPanel>
              <ControlPanel>
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
                    handleRejectAnswer(
                      answerRequiringAttention.id,
                      answerRequiringAttention.exercise_id,
                    )
                  } // Accept answer
                >
                  {t("button-text-zero-points")}
                </Button>
                <Button
                  size="medium"
                  variant="primary"
                  onClick={() =>
                    handleAcceptAnswer(
                      answerRequiringAttention.id,
                      answerRequiringAttention.exercise_id,
                    )
                  }
                >
                  {t("button-text-full-points")}
                </Button>
                <Button
                  size="medium"
                  variant="blue"
                  onClick={() =>
                    handleAcceptAnswer(
                      answerRequiringAttention.id,
                      answerRequiringAttention.exercise_id,
                    )
                  }
                >
                  {t("button-text-custom-points")}
                </Button>
                <div
                  className={css`
                    margin-left: auto;
                  `}
                >
                  <Button
                    className={css`
                      margin-left: 0.5em;
                    `}
                    size="medium"
                    variant="tertiary"
                    onClick={() =>
                      handleFlagAsPlagiarismAnswer(
                        answerRequiringAttention.id,
                        answerRequiringAttention.exercise_id,
                      )
                    } // flag as plagiarism
                  >
                    {t("button-text-flag-as-plagiarism")}
                  </Button>
                </div>
              </ControlPanel>
            </div>
          </AnswerLayout>
        ))}
        <DebugModal data={answersRequiringAttention}></DebugModal>
      </Layout>
    </>
  )
}

export default AnswersRequiringAttentionList
