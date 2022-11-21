import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { PrivateSpecQuizItemTimeline } from "../../../../../types/quizTypes"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import { baseTheme } from "../../../../shared-module/styles"
import {
  addedTimelineItemAction,
  deleteTimelineItemEventAction,
  editTimelineItemEventAction,
  editTimelineItemYearAction,
} from "../../../../store/editor/timelineItems/timelineItemsActions"
import { useTypedSelector } from "../../../../store/store"

interface TimelineContentProps {
  item: PrivateSpecQuizItemTimeline
}

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

  @media (max-width: 767.98px) {
    grid-template-columns: 1fr;
    gap: 0px;
  }
`

const StyledBtn = styled.button`
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
  top: 25px;

  svg {
    transform: rotate(45deg) scale(1.2);
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
    width: 100%;
  }
`
const DeleteBtn = styled.button`
  width: 50px;
  height: 49px;
  background: #e2c2bc;
  outline: none;
  justify-self: end;
  border: none;
  position: relative;
  top: 30px;
  color: ${baseTheme.colors.red[700]};
  svg {
    transform: scale(1.2);
  }

  @media (max-width: 767.98px) {
    width: 100%;
  }
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
    grid-template-columns: 100%;
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

const TimelineContent: React.FC<React.PropsWithChildren<TimelineContentProps>> = ({ item }) => {
  const storeTimelineItems = useTypedSelector((state) => state.editor.timelineItems)
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const dispatch = useDispatch()
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

  return (
    <Wrapper>
      {storeTimelineItems &&
        storeItem.timelineItems?.map((timelineItemId) => {
          const timelineItem = storeTimelineItems[timelineItemId]
          return (
            <List key={timelineItem.id} id={timelineItem.id}>
              <TextField
                className={cx(yearTextFieldStyles, alreadyInputtedTextFieldStyles)}
                label={t("label-year")}
                onChange={(value) => {
                  dispatch(editTimelineItemYearAction(timelineItemId, value))
                }}
                value={timelineItem.year}
              />

              <TextField
                className={cx(alreadyInputtedTextFieldStyles)}
                label={t("label-correct-event")}
                onChange={(value) => {
                  dispatch(editTimelineItemEventAction(timelineItemId, value))
                }}
                value={timelineItem.correctEventName}
              />

              <DeleteBtn
                onClick={() => {
                  dispatch(deleteTimelineItemEventAction(item.id, timelineItemId))
                }}
              >
                <FontAwesomeIcon icon={faXmark} />
              </DeleteBtn>
            </List>
          )
        })}
      <h2
        className={css`
          font-size: 20px !important;
          color: ${baseTheme.colors.grey[500]};
          margin-top: 2rem;
        `}
      >
        {t("add-new-event")}
      </h2>
      <StyledForm
        onSubmit={handleSubmit(async (data) => {
          dispatch(addedTimelineItemAction(item.id, data.year, data.event))
          reset()
        })}
      >
        <TextField
          className={cx(yearTextFieldStyles)}
          label={t("label-year")}
          name={FIELD_NAME_YEAR}
          placeholder={YEAR_PLACEHOLDER}
          register={register("year", { required: true, pattern: /^\s*\d+/ })}
        />
        <TextField
          label={t("label-correct-event")}
          name={FIELD_NAME_EVENT}
          placeholder={t("placeholder-some-notable-event")}
          register={register("event", { required: true })}
        />
        <StyledBtn
          aria-label={t("add")}
          type="submit"
          name={t("submit")}
          value={t("submit")}
          disabled={!isValid || isSubmitting}
        >
          <FontAwesomeIcon icon={faXmark} />
        </StyledBtn>
      </StyledForm>
    </Wrapper>
  )
}

export default TimelineContent
