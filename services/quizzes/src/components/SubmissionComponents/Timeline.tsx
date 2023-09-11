import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerTimeline } from "../../../types/quizTypes/answer"
import { ModelSolutionQuizItemTimeline } from "../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItemTimeline } from "../../../types/quizTypes/publicSpec"
import { baseTheme, headingFont } from "../../shared-module/styles"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import { QuizItemSubmissionComponentProps } from "."

const TimelineWrapper = styled.section`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  position: relative;
  width: 100%;
  max-width: 1140px;
  margin: 0 auto;
  padding: 15px 0;

  &::after {
    content: "";
    position: absolute;
    width: 2px;
    background: #e2e4e6;
    top: 0;
    bottom: 0;
    left: 50%;
    margin-left: -1px;
    @media (max-width: 767.98px) {
      left: 80px;
    }
  }
`
const container = css`
  padding: 15px 30px;
  position: relative;
  width: 50%;

  .date {
    position: absolute;
    display: inline-block;
    top: calc(50% - 15px);
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    color: #006e51;
    text-transform: uppercase;
    letter-spacing: 1;
    z-index: 1;
  }

  .content {
    padding: 30px 30px 30px 30px;
    position: relative;
  }

  @media (max-width: 767.98px) {
    width: 100%;
    padding-left: 120px;
    padding-right: 0px;
  }
`
const left = css`
  left: 0;

  .date {
    right: -75px;
    @media (max-width: 767.98px) {
      right: auto;
      left: 15px;
    }
  }

  &::after {
    @media (max-width: 767.98px) {
      left: 65px;
    }
  }

  .content {
    @media (max-width: 767.98px) {
      padding: 30px 0px 30px 0px;
    }
  }
`
const right = css`
  left: 50%;

  @media (max-width: 767.98px) {
    left: 0%;
  }

  .date {
    left: -75px;
    @media (max-width: 767.98px) {
      right: auto;
      left: 15px;
    }
  }

  .content {
    padding: 30px 30px 30px 30px;
    @media (max-width: 767.98px) {
      padding: 30px 0px 30px 0px;
    }
  }

  &::after {
    left: -15px;
    @media (max-width: 767.98px) {
      left: 65px;
    }
  }
`

export interface Time {
  id: string
  date: string
  text: string
}

const Timeline: React.FunctionComponent<
  React.PropsWithChildren<
    QuizItemSubmissionComponentProps<PublicSpecQuizItemTimeline, UserItemAnswerTimeline>
  >
> = ({ public_quiz_item, quiz_item_model_solution, user_quiz_item_answer, quiz_item_feedback }) => {
  const { t } = useTranslation()

  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemTimeline

  return (
    <TimelineWrapper>
      {public_quiz_item.timelineItems
        .sort((a, b) => Number(a.year) - Number(b.year))
        .map((timelineItem, n) => {
          const selectedTimelineItem = user_quiz_item_answer?.timelineChoices?.find(
            (tc) => tc.timelineItemId === timelineItem.itemId,
          )

          const selectedTimelineEventDetails = public_quiz_item.events.find(
            (te) => te.eventId === selectedTimelineItem?.chosenEventId,
          )

          const timelinemItemFeedback = quiz_item_feedback?.timeline_item_feedbacks?.find(
            (tif) => tif.timeline_item_id === timelineItem.itemId,
          )

          const whatWasChosenWasCorrect = timelinemItemFeedback?.what_was_chosen_was_correct
          const modelSolutionCorrectEventId = modelSolution?.timelineItems?.find(
            (ti) => ti.id === timelineItem.itemId,
          )?.correctEventId
          const modelSolutionCorrectEventName = public_quiz_item.events.find(
            (te) => te.eventId === modelSolutionCorrectEventId,
          )?.name

          const align = n % 2 === 0 ? right : left
          return (
            <div
              className={`${container} ${align} ${css`
                &::after {
                  content: "";
                  position: absolute;
                  width: 30px;
                  height: 30px;
                  top: calc(50% - 20px);
                  right: -15px;
                  background: ${whatWasChosenWasCorrect ? "#32BEA6" : baseTheme.colors.clear[200]};
                  border: ${whatWasChosenWasCorrect ? "4px solid #EBEDEE" : "2px solid #767B85"};
                  border-style: solid;
                  border-radius: 16px;
                  transition: all 200ms linear;
                  z-index: 1;
                }
              `}`}
              key={timelineItem.itemId}
            >
              <div className="date">{timelineItem.year}</div>
              <div className="content">
                {!selectedTimelineItem && <>{t("not-answered")}</>}
                {selectedTimelineItem && (
                  <div>
                    <div
                      className={css`
                        background-color: ${whatWasChosenWasCorrect
                          ? baseTheme.colors.green[300]
                          : baseTheme.colors.red[400]};
                        border: none;
                        margin: 0;
                        width: 100%;
                        display: flex;
                        align-items: center;
                      `}
                      id={timelineItem.itemId}
                    >
                      <p
                        className={css`
                          padding: 8px 2px 8px 17px;
                          width: 100%;
                        `}
                      >
                        {selectedTimelineEventDetails?.name ?? t("deleted-option")}
                      </p>
                      <FontAwesomeIcon
                        icon={whatWasChosenWasCorrect ? faCheck : faXmark}
                        aria-label={
                          whatWasChosenWasCorrect
                            ? t("your-answer-was-correct")
                            : t("your-answer-was-not-correct")
                        }
                        aria-hidden={false}
                        className={css`
                          padding: 0.5rem 1rem;
                          color: ${whatWasChosenWasCorrect
                            ? baseTheme.colors.green[700]
                            : baseTheme.colors.red[700]};
                        `}
                      />
                    </div>
                    {!whatWasChosenWasCorrect && modelSolutionCorrectEventName && (
                      <div
                        className={css`
                          background-color: ${baseTheme.colors.clear[200]};
                          padding-top: 10px;
                          padding-left: 17px;
                          padding-right: 17px;
                          padding-bottom: 10px;
                          font-size: 13px;
                        `}
                      >
                        <div
                          className={css`
                            font-family: ${headingFont};
                            text-transform: uppercase;
                            color: ${baseTheme.colors.clear[100]};
                            background-color: ${baseTheme.colors.green[400]};
                            width: fit-content;
                            font-size: 12px;
                            margin-bottom: 0.5rem;
                            font-weight: 600;
                            padding: 3px;
                            line-height: 100%;

                            span {
                              position: relative;
                              top: 1px;
                            }
                          `}
                        >
                          <span>{t("correct-option")}</span>
                        </div>
                        {modelSolutionCorrectEventName}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
    </TimelineWrapper>
  )
}

export default withErrorBoundary(Timeline)
