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
import SelectMenu from "../../../../shared-module/components/SelectMenu"
import { headingFont } from "../../../../shared-module/styles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import { QuizItemComponentProps } from "."

const TimelineWrapper = styled.section`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  flex: 1;
  position: relative;
  width: 100%;
  max-width: 1140px;
  margin: 0 auto;
  padding: 15px 0;
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
    font-size: 16px;
    font-weight: 500;
    color: #4c5868;
    font-family: ${headingFont};
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
const StyledTime = styled.div`
  background-color: #f3f5f7;
  border-radius: 2px;
  border: none;
  margin: 0;
  width: 100%;
  display: flex;
`
const StyledButton = styled.button`
  background-color: #f3f5f7;
  width: 80px;
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
                  width: 48px;
                  height: 40px;
                  top: calc(50% - 20px);
                  right: -15px;
                  background: ${selectedTimelineItem ? "#77C299" : "#EBEDEE"};
                  border: ${selectedTimelineItem ? "none" : "2px solid #898E99"};
                  border-style: ${selectedTimelineItem ? "none" : "dashed"};
                  ${selectedTimelineItem &&
                  `box-shadow:
                  rgba(45, 35, 66, 0) 0 2px 4px,
                  rgba(45, 35, 66, 0) 0 7px 13px -3px,
                  #69AF8A 0 -2px 0 inset;`};
                  border-radius: 25px;
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
                  top: 96px;
                  bottom: 0;
                  left: 50%;
                  height: 60%;
                  border: 3px solid #ebedee;
                  border-radius: 99px;
                  margin-left: 6px;
                  @media (max-width: 767.98px) {
                    left: 80px;
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
                            chosenEventId: event.target.value,
                          },
                        ]
                        setQuizItemAnswerState({
                          quizItemId: quizItem.id,
                          type: "timeline",
                          timelineChoices: [
                            {
                              timelineItemId: timelineItem.itemId,
                              chosenEventId: event.target.value,
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
                        { timelineItemId: timelineItem.itemId, chosenEventId: event.target.value },
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
                        padding: 8px 2px 8px 8px;
                        width: 100%;
                        color: #4c5868;
                      `}
                    >
                      {selectedTimelineEventDetails?.name ?? t("deleted-option")}
                    </p>
                    <StyledButton
                      aria-label={t("remove")}
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
