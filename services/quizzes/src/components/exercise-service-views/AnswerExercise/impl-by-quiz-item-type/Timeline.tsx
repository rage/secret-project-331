import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { TimelineChoice, UserItemAnswerTimeline } from "../../../../../types/quizTypes/answer"
import {
  PublicSpecQuizItemTimeline,
  PublicSpecQuizItemTimelineItem,
} from "../../../../../types/quizTypes/publicSpec"
import SelectMenu from "../../../../shared-module/common/components/SelectMenu"
import withErrorBoundary from "../../../../shared-module/common/utils/withErrorBoundary"

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
const StyledTime = styled.div`
  background-color: #e5e0f1;
  border: none;
  margin: 0;
  width: 100%;
  display: flex;
`
const StyledButton = styled.button`
  background-color: #b1a2d4;
  width: 80px;
  justify-self: end;
  height: auto;
  margin: 0;
  position: relative;
  border: none;

  &:after {
    content: "+";
    width: 40%;
    color: #51309f;
    position: absolute;
    font-size: 2.8rem;
    line-height: 0.5;
    top: calc(50% - 14px);
    right: 30%;
    font-weight: 200;
    padding-bottom: 5px;
    transform: rotate(45deg);
  }
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
                  width: 30px;
                  height: 30px;
                  top: calc(50% - 20px);
                  right: -15px;
                  background: ${selectedTimelineItem ? "#32BEA6" : "#EBEDEE"};
                  border: ${selectedTimelineItem ? "4px solid #EBEDEE" : "2px solid #767B85"};
                  border-style: ${selectedTimelineItem ? "solid" : "dashed"};
                  border-radius: 16px;
                  transition: all 200ms linear;
                  z-index: 1;
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
                    ></StyledButton>
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
