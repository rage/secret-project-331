"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { MinusCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { TimelineChoice, UserItemAnswerTimeline } from "../../../../../types/quizTypes/answer"
import {
  PublicSpecQuizItemTimeline,
  PublicSpecQuizItemTimelineItem,
} from "../../../../../types/quizTypes/publicSpec"

import { QuizItemComponentProps } from "."

import SelectMenu from "@/shared-module/common/components/SelectMenu"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { headingFont } from "@/shared-module/exercise-react/styles"

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

  /* On narrow screens the timeline flows as a single column: the year label is stacked on top
     of the select so everything fits into a 320 CSS px wide viewport (WCAG 1.4.10). */
  @media (max-width: 767.98px) {
    width: 100%;
    padding-left: 0;
    padding-right: 0;

    .date {
      position: static;
      display: block;
      text-align: left;
      margin-bottom: 0.25rem;
    }
  }
`
const left = css`
  left: 0;

  .date {
    right: -4.688rem;
    @media (max-width: 767.98px) {
      right: auto;
      left: auto;
    }
  }

  .content {
    @media (max-width: 767.98px) {
      padding: 0 0 1rem 0;
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
      left: auto;
    }
  }

  .content {
    padding: 1.875rem;
    @media (max-width: 767.98px) {
      padding: 0 0 1rem 0;
    }
  }

  &::after {
    left: -0.938rem;
  }
`
const StyledTime = styled.div`
  background-color: #f3f5f7;
  border-radius: 0.125rem;
  border: none;
  margin: 0;
  width: 100%;
  display: flex;
`
const StyledButton = styled.button`
  background-color: #f3f5f7;
  width: 5rem;
  justify-self: end;
  height: auto;
  margin: 0;
  color: #4c5868;
  position: relative;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
`

export interface Time {
  id: string
  date: string
  text: string
}

const Timeline: React.FunctionComponent<
  QuizItemComponentProps<PublicSpecQuizItemTimeline, UserItemAnswerTimeline>
> = ({ quizItemAnswerState, quizItem, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const chosenEventIds = (quizItemAnswerState?.timelineChoices ?? []).map((tc) => tc.chosenEventId)
  const hasDuplicateAnswers = chosenEventIds.length !== new Set(chosenEventIds).size
  return (
    <TimelineWrapper>
      {quizItem.timelineItems
        .sort((a, b) => Number(a.year) - Number(b.year))
        .map((timelineItem, n) => {
          const selectedTimelineItem = quizItemAnswerState?.timelineChoices?.find(
            (tc) => tc.timelineItemId === timelineItem.itemId,
          )

          const selectedTimelineEventDetails = quizItem.events.find(
            (te) => te.eventId === selectedTimelineItem?.chosenEventId,
          )

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
                  right: -0.125rem;
                  background: ${selectedTimelineItem ? "#77C299" : "#EBEDEE"};
                  border: ${selectedTimelineItem ? "none" : "0.125rem solid #898E99"};
                  border-style: ${selectedTimelineItem ? "none" : "dashed"};
                  ${
                    selectedTimelineItem &&
                    `box-shadow:
                  rgba(45, 35, 66, 0) 0 2px 4px,
                  rgba(45, 35, 66, 0) 0 7px 13px -3px,
                  #69AF8A 0 -2px 0 inset;`
                  };
                  border-radius: 1.563rem;
                  transition: all 200ms linear;
                  z-index: 1;

                  /* The decorative marker is hidden in the narrow single-column layout so the
                     content fits into 320 CSS px (WCAG 1.4.10). */
                  @media (max-width: 767.98px) {
                    display: none;
                  }
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
                  top: 6rem;
                  bottom: 0;
                  left: 50%;
                  height: 60%;
                  border: 0.188rem solid #ebedee;
                  border-radius: 6.188rem;
                  margin-left: 0.375rem;
                  @media (max-width: 767.98px) {
                    display: none;
                  }
                }
              `}`}
              key={timelineItem.itemId}
            >
              <label htmlFor={`select-${timelineItem.itemId}`} className="date">
                {timelineItem.year}
              </label>
              <div className="content">
                {!selectedTimelineItem && (
                  <SelectMenu
                    id={`select-${timelineItem.itemId}`}
                    options={quizItem.events.map((tie) => {
                      return { label: tie.name, value: tie.eventId }
                    })}
                    onChange={(event) => {
                      if (!quizItemAnswerState) {
                        const choices = [
                          {
                            timelineItemId: timelineItem.itemId,
                            chosenEventId: event.currentTarget.value,
                          },
                        ]
                        setQuizItemAnswerState({
                          quizItemId: quizItem.id,
                          type: "timeline",
                          timelineChoices: [
                            {
                              timelineItemId: timelineItem.itemId,
                              chosenEventId: event.currentTarget.value,
                            },
                          ],
                          valid: validate(choices, quizItem.timelineItems),
                        })
                        return
                      }
                      const timelineChoicesWithoutThisOne =
                        quizItemAnswerState.timelineChoices?.filter(
                          (tc) => tc.timelineItemId !== timelineItem.itemId,
                        ) || []
                      const newTimelineChoices: TimelineChoice[] = [
                        ...timelineChoicesWithoutThisOne,
                        {
                          timelineItemId: timelineItem.itemId,
                          chosenEventId: event.currentTarget.value,
                        },
                      ]

                      setQuizItemAnswerState({
                        ...quizItemAnswerState,
                        timelineChoices: newTimelineChoices,
                        valid: validate(newTimelineChoices, quizItem.timelineItems),
                      })
                    }}
                  />
                )}
                {selectedTimelineItem && (
                  <StyledTime id={timelineItem.itemId}>
                    <p
                      className={css`
                        padding: 0.5rem 0.125rem 0.5rem 0.5rem;
                        width: 100%;
                        color: #4c5868;
                      `}
                    >
                      {selectedTimelineEventDetails?.name ?? t("deleted-option")}
                    </p>
                    <StyledButton
                      aria-label={t("remove-answer-for-year", { year: timelineItem.year })}
                      onClick={() => {
                        if (!quizItemAnswerState) {
                          return
                        }
                        const timelineChoicesWithoutThisOne =
                          quizItemAnswerState.timelineChoices?.filter(
                            (tc) => tc.timelineItemId !== timelineItem.itemId,
                          ) || []
                        setQuizItemAnswerState({
                          ...quizItemAnswerState,
                          timelineChoices: timelineChoicesWithoutThisOne,
                          valid: validate(timelineChoicesWithoutThisOne, quizItem.timelineItems),
                        })
                      }}
                    >
                      <MinusCircle size={20} weight="medium" />
                    </StyledButton>
                  </StyledTime>
                )}
              </div>
            </div>
          )
        })}
      {/* Persistent live region: duplicate answers keep the submit button disabled, so the
          reason is announced to screen readers and shown visually as soon as it happens. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={css`
          margin-top: 1rem;
        `}
      >
        {hasDuplicateAnswers ? (
          <div
            className={css`
              padding: 0.875rem;
              border-radius: 0.5rem;
              background-color: #fff4e6;
              border: 2px solid #cc7a00;
              color: #b83900;
              font-size: 1rem;
              line-height: 1.5;
            `}
          >
            {t("timeline-duplicate-answer-error")}
          </div>
        ) : null}
      </div>
    </TimelineWrapper>
  )
}

function validate(
  timelineChoices: TimelineChoice[],
  timelineItems: PublicSpecQuizItemTimelineItem[],
): boolean {
  const allAnswered = timelineItems.every((ti) => {
    return timelineChoices.some((tc) => tc.timelineItemId === ti.itemId)
  })
  const noDuplicateAnswers =
    timelineChoices.length === new Set(timelineChoices.map((ch) => ch.chosenEventId)).size
  const numberOfAnswersMatch = timelineChoices.length === timelineItems.length

  return allAnswered && noDuplicateAnswers && numberOfAnswersMatch
}

export default withErrorBoundary(Timeline)
