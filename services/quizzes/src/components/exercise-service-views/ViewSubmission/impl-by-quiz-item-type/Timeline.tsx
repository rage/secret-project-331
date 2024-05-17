import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { CheckCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerTimeline } from "../../../../../types/quizTypes/answer"
import { ModelSolutionQuizItemTimeline } from "../../../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItemTimeline } from "../../../../../types/quizTypes/publicSpec"

import { QuizItemSubmissionComponentProps } from "."

import { baseTheme, headingFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const TimelineWrapper = styled.section`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  flex: 1;
  position: relative;
  width: 100%;
  max-width: 71.25rem;
  margin: 0 auto;
  padding: 0.938rem 0;
`
const container = css`
  padding: 0.938rem 1.875rem;
  position: relative;
  width: 50%;

  .date {
    position: absolute;
    display: inline-block;
    top: calc(50% - 15px);
    text-align: center;
    font-size: 1rem;
    font-weight: 600;
    color: #4c5868;
    font-family: ${headingFont};
    letter-spacing: 1;
    z-index: 1;
  }

  .content {
    padding: 1.875rem;
    position: relative;
  }

  @media (max-width: 767.98px) {
    width: 100%;
    padding-left: 7.5rem;
    padding-right: 0px;
  }
`
const left = css`
  left: 0;

  .date {
    right: -4.688rem;
    @media (max-width: 767.98px) {
      right: auto;
      left: 0.938rem;
    }
  }

  &::after {
    @media (max-width: 767.98px) {
      left: 4.063rem;
    }
  }

  .content {
    @media (max-width: 767.98px) {
      padding: 1.875rem 0 1.875rem 0.625rem;
    }
  }
`
const right = css`
  left: 50%;

  @media (max-width: 767.98px) {
    left: 0%;
  }

  .date {
    left: -4.688rem;
    @media (max-width: 767.98px) {
      right: auto;
      left: 0.938rem;
    }
  }

  .content {
    padding: 1.875rem;
    @media (max-width: 767.98px) {
      padding: 1.875rem 0 1.875rem 0.625rem;
    }
  }

  &::after {
    left: -0.938rem;
    @media (max-width: 767.98px) {
      left: 4.063rem;
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
> = ({
  public_quiz_item,
  quiz_item_model_solution,
  user_quiz_item_answer,
  quiz_item_answer_feedback,
}) => {
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

          const timelinemItemFeedback = quiz_item_answer_feedback?.timeline_item_feedbacks?.find(
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
                  width: 3rem;
                  height: 2.5rem;
                  top: calc(50% - 20px);
                  right: -0.938rem;
                  background: ${selectedTimelineItem ? "#77C299" : "#EBEDEE"};
                  border: ${selectedTimelineItem ? "none" : "0.125rem solid #898E99"};
                  border-style: ${selectedTimelineItem ? "none" : "dashed"};
                  ${selectedTimelineItem &&
                  `box-shadow:
                rgba(45, 35, 66, 0) 0 2px 4px,
                rgba(45, 35, 66, 0) 0 7px 13px -3px,
                #69AF8A 0 -2px 0 inset;`};
                  border-radius: 1.563rem;
                  transition: all 200ms linear;
                  z-index: 1;
                }

                .select-wrapper {
                  margin-bottom: 0px !important;
                }

                .content > div {
                  margin-bottom: 0px !important;
                }

                &:not(:last-child)::before {
                  content: "";
                  position: absolute;
                  top: 60%;
                  bottom: 0;
                  left: 50%;
                  height: 100%;
                  border: 0.188rem solid #ebedee;
                  border-radius: 6.188rem;
                  margin-left: 0.375rem;
                  @media (max-width: 767.98px) {
                    left: 80px;
                  }
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
                        background-color: ${whatWasChosenWasCorrect ? "#D5EADF" : "#EDD3D6"};
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
                      <div
                        className={css`
                          padding: 0.5rem 1rem;
                          color: ${whatWasChosenWasCorrect ? "#246F46" : "#D75861"};
                          width: 50px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                        `}
                      >
                        {whatWasChosenWasCorrect ? (
                          <CheckCircle
                            size={20}
                            className={css`
                              color: ${baseTheme.colors.green[700]};
                            `}
                            aria-label={t("your-answer-was-correct")}
                          />
                        ) : (
                          <XmarkCircle
                            size={20}
                            className={css`
                              color: ${baseTheme.colors.red[700]};
                            `}
                            aria-label={t("your-answer-was-not-correct")}
                          />
                        )}
                      </div>
                    </div>
                    {!whatWasChosenWasCorrect && modelSolutionCorrectEventName && (
                      <div
                        className={css`
                          background-color: #f2f2f2;
                          padding-top: 0.625rem;
                          padding-left: 1.063rem;
                          padding-right: 1.063rem;
                          padding-bottom: 0.625rem;
                          font-size: 0.813rem;
                        `}
                      >
                        <div
                          className={css`
                            font-family: ${headingFont};
                            color: ${baseTheme.colors.clear[100]};
                            background-color: ${baseTheme.colors.green[400]};
                            width: fit-content;
                            margin-bottom: 0.4rem;
                            line-height: 100%;

                            font-size: 0.625rem;
                            text-transform: uppercase;
                            font-weight: bold;
                            padding: 0.2rem 0.375rem 0.25rem 0.375rem;
                            border-radius: 0.125rem;

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
