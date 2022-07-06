import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"
import { useTranslation } from "react-i18next"

import { AnswerRequiringAttention } from "../../../../../../shared-module/bindings"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"

interface Props {
  answersRequiringAttention: AnswerRequiringAttention[]
}

const Layout = styled.div`
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

const TopBar = styled.div`
  width: 100%;
  height: 108px;
  background: #1f6964;
  display: flex;
  align-items: center;
`

const BottomBar = styled.div`
  background: #f5f5f5;
`

const AnswersRequiringAttentionList: React.FC<Props> = ({ answersRequiringAttention }) => {
  const { t } = useTranslation()
  if (answersRequiringAttention.length === 0) {
    return <div>{t("no-answers-requiring-attention")}</div>
  }
  return (
    <>
      <Layout>
        {answersRequiringAttention.map((testing) => (
          <AnswerLayout key={testing.id}>
            <TopBar>
              <StyledIconDark icon={faCircleExclamation} />
              <div id="text-column">
                <p
                  className={css`
                    color: #f5f6f7cc;
                    font-size: 16px;
                    font-weight: 500;
                    line-height: 16px;
                    letter-spacing: 0em;
                    margin-bottom: 0.5em;
                  `}
                >
                  {t("answered-at", {
                    time: `${testing?.created_at.toDateString()} ${testing?.created_at.toLocaleTimeString()}`,
                  })}{" "}
                </p>
                <p
                  className={css`
                    font-size: 17px;
                    font-weight: 400;
                    line-height: 17px;
                    letter-spacing: 0em;
                    text-align: left;
                    color: white;
                  `}
                >
                  {" "}
                  {t("user-id")}: {testing?.user_id}
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
                <p>POINT: 1/2</p>
              </div>
            </TopBar>
            <p
              className={css`
                margin-top: 2em;
                margin-bottom: 1em;
              `}
            >
              {t("student-answer")}
            </p>

            {/*tasks
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
              ))*/}
            {/* eslint-disable-next-line i18next/no-literal-string*/}
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis in justo scelerisque,
              iaculis tellus vel, hendrerit ante. Nullam malesuada velit id sem pharetra mollis.
              Duis vitae tincidunt nisi. Morbi scelerisque viverra sem et sagittis. In hac habitasse
              platea dictumst. Aliquam in faucibus justo, vel fermentum sem. Sed eget felis mauris.
              Aliquam fermentum, est quis imperdiet mollis, mauris leo varius ipsum, sed lacinia
              ante tellus et nunc. Phasellus eget nunc ut nibh tempor ultricies. Etiam at justo quis
              lacus malesuada tristique non id tortor. Cras vitae tristique turpis. Mauris egestas
              ante id est fermentum, id finibus tellus ornare. Mauris posuere, arcu quis fermentum
              pellentesque, justo elit tempor erat, cursus semper odio est mattis ante. In nec
              tempor lacus. Vivamus dictum erat at massa consequat, quis viverra ex pellentesque.
              Sed tempor lorem non nibh venenatis rhoncus.{" "}
            </p>
            <BottomBar></BottomBar>
          </AnswerLayout>
        ))}
      </Layout>
    </>
  )
}

export default AnswersRequiringAttentionList
