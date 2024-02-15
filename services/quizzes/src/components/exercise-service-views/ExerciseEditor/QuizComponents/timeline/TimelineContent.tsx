import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { PlusCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { OldNormalizedQuizItemTimelineItem } from "../../../../../../types/oldQuizTypes"
import { PrivateSpecQuizItemTimeline } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import TextField from "../../../../../shared-module/common/components/InputFields/TextField"
import { baseTheme } from "../../../../../shared-module/common/styles"
import findQuizItem from "../../utils/general"

interface TimelineContentProps {
  quizItemId: string
}

const BASE_BUTTON_STYLES = `
  width: 50px;
  height: 49px;
  border: none;
  outline: none;
  position: relative;
`

const Wrapper = styled.div`
  font-size: 16px;
  margin: 0 auto;

  span {
    display: inline-block;
    font-size: 18px;
    margin-bottom: 10px;
    color: #1a2333;
  }

  h2 {
    font-weight: 300;
    opacity: 0.8;
    font-size: 1.7rem;
  }
`
const StyledForm = styled.form`
  display: grid;
  grid-template-columns: 0.1fr 2.2fr 0.1fr;
  gap: 10px;
  margin-top: 12px;
  height: 75px;
`

const StyledBtn = styled.button`
  ${BASE_BUTTON_STYLES}
  width: 50px;
  height: 49px;
  background: #dae3eb;
  border: none;
  outline: none;
  display: flex;
  justify-content: center;
  align-items: center;
  justify-self: end;
  position: relative;
  top: 19px;

  svg {
    transform: scale(1.2);
    width: 20px;
    .bg {
      fill: #08457a;
    }
  }

  &:disabled {
    filter: grayscale(100%) opacity(0.7) contrast(1.1);
    cursor: not-allowed;
  }

  @media (max-width: 767.98px) {
    height: 48px;
  }
`
const DeleteBtn = styled.button`
  ${BASE_BUTTON_STYLES}
  width: 50px;
  height: 49px;
  background: #e2c2bc;
  outline: none;
  display: flex;
  justify-content: center;
  align-items: center;
  justify-self: end;
  border: none;
  position: relative;
  top: 18%;
  color: ${baseTheme.colors.red[700]};
  svg {
    transform: scale(1.2);
  }

  @media (max-width: 767.98px) {
    height: 47px;
  }
`

const ButtonWrapper = styled.div`
  position: relative;
`

const List = styled.div`
  display: grid;
  grid-template-columns: 0.1fr 2.2fr 0.1fr;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 20px;
  height: 75px;

  @media (max-width: 767.98px) {
    grid-template-columns: 0.1fr 2.2fr 0.1fr;
    gap: 5px;
  }
`

const alreadyInputtedTextFieldStyles = css`
  input:not(:focus) {
    background: #f5f6f7;
    border: 1.5px solid #e2e4e6;
  }
`

const yearTextFieldStyles = css`
  width: 80px;
  display: inline-block;
`

export interface Timeline {
  id: string
  year: string
  content: string
}
const YEAR_PLACEHOLDER = "1994"
const FIELD_NAME_EVENT = "event"
const FIELD_NAME_YEAR = "year"

interface Fields {
  year: string
  event: string
}

const TimelineContent: React.FC<React.PropsWithChildren<TimelineContentProps>> = ({
  quizItemId,
}) => {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    formState: { isValid, isSubmitting },
    reset,
  } = useForm<Fields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      year: "",
      event: "",
    },
  })

  const { selected, updateState } =
    useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemTimeline>((quiz) => {
      // eslint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemTimeline>(quiz, quizItemId, "timeline")
    })

  if (selected === null) {
    return <></>
  }

  return (
    <Wrapper>
      {selected &&
        selected.timelineItems &&
        selected.timelineItems.map((timelineItem) => {
          if (!timelineItem) {
            return <></>
          }
          return (
            <List key={timelineItem.id} id={timelineItem.id}>
              <TextField
                className={cx(yearTextFieldStyles, alreadyInputtedTextFieldStyles)}
                label={t("label-year")}
                onChangeByValue={(value) => {
                  updateState((draft) => {
                    if (!draft || !draft.timelineItems) {
                      return
                    }
                    const parsedYear = parseInt(value)
                    draft.timelineItems = draft.timelineItems.map((item) => {
                      if (item.id === timelineItem.id) {
                        return {
                          ...item,
                          year: isNaN(parsedYear) ? "0" : value,
                        } as OldNormalizedQuizItemTimelineItem
                      }
                      return item
                    })
                  })
                }}
                value={timelineItem.year}
              />

              <TextField
                className={cx(alreadyInputtedTextFieldStyles)}
                label={t("label-correct-event")}
                onChangeByValue={(value) => {
                  updateState((draft) => {
                    if (!draft || !draft.timelineItems) {
                      return
                    }

                    draft.timelineItems = draft.timelineItems.map((item) => {
                      if (item.id === timelineItem.id) {
                        return {
                          ...item,
                          correctEventName: value,
                        }
                      }
                      return item
                    })
                  })
                }}
                value={timelineItem.correctEventName}
              />
              <ButtonWrapper>
                <DeleteBtn
                  aria-label={t("delete")}
                  onClick={() => {
                    updateState((draft) => {
                      if (!draft || !draft.timelineItems) {
                        return
                      }
                      draft.timelineItems = draft.timelineItems.filter(
                        (item) => item.id !== timelineItem.id,
                      )
                    })
                  }}
                >
                  <XmarkCircle size={22} />
                </DeleteBtn>
              </ButtonWrapper>
            </List>
          )
        })}
      <h2
        className={css`
          font-size: 20px !important;
          color: ${baseTheme.colors.gray[500]};
          margin-top: 2rem;
        `}
      >
        {t("add-new-event")}
      </h2>
      <StyledForm
        onSubmit={handleSubmit(async (data) => {
          updateState((draft) => {
            if (!draft || !draft.timelineItems) {
              return
            }
            draft.timelineItems.push({
              id: v4(),
              correctEventId: v4(),
              year: data.year,
              correctEventName: data.event,
            } as OldNormalizedQuizItemTimelineItem)
          })
          reset()
        })}
      >
        <TextField
          className={cx(yearTextFieldStyles)}
          label={t("label-year")}
          placeholder={YEAR_PLACEHOLDER}
          {...register("year", { required: true, pattern: /^\s*\d+/ })}
          name={FIELD_NAME_YEAR}
        />
        <TextField
          label={t("label-correct-event")}
          placeholder={t("placeholder-some-notable-event")}
          {...register("event", { required: true })}
          name={FIELD_NAME_EVENT}
        />
        <StyledBtn
          aria-label={t("add")}
          type="submit"
          name={t("submit")}
          value={t("submit")}
          disabled={!isValid || isSubmitting}
        >
          <PlusCircle />
        </StyledBtn>
      </StyledForm>
    </Wrapper>
  )
}

export default TimelineContent
