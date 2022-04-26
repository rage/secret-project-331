import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CrossIcon from "../img/exist-icon.svg"

import TextAreaField from "./InputFields/EditableComponentTextArea"
import TextField from "./InputFields/TextField"

const Wrapper = styled.div`
  margin: 0 auto;
  max-width: 1000px;
  height: 100%;

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

  @media (max-width: 767.98px) {
    grid-template-columns: 1fr;
    gap: 0px;
  }
`
const StyledTextField = styled(TextField)`
  @media (max-width: 767.98px) {
    height: 55px !important;
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

  svg {
    transform: rotate(45deg);
    width: 20px;
    .bg {
      fill: #08457a;
    }
  }

  @media (max-width: 767.98px) {
    width: 100%;
  }
`
const DeleteBtn = styled.button`
  width: 50px;
  min-height: 49px;
  background: #e2c2bc;
  outline: none;
  justify-self: end;
  border: none;

  @media (max-width: 767.98px) {
    width: 100%;
  }
`
const List = styled.div`
  display: grid;
  grid-template-columns: 0.1fr 2.2fr 0.1fr;
  min-height: 40px;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 20px;

  @media (max-width: 767.98px) {
    grid-template-columns: 100%;
    gap: 5px;
    margin-bottom: 30px;
  }
`
const Date = styled.div`
  background: #f5f6f7;
  border: 1.5px solid #e2e4e6;
  width: 280px;
  padding: 0.4rem 1rem;
  border-radius: 3px;

  @media (max-width: 767.98px) {
    width: 100%;
  }
`
const Event = styled.div`
  background: #f5f6f7;
  border: 1.5px solid #e2e4e6;
  border-radius: 3px;
  width: 100%;
  align-items: center;
  padding: 0.4rem 1rem;

  @media (max-width: 767.98px) {
    width: 100%;
  }
`
export interface Timeline {
  id: string
  year: string
  content: string
}

const PLACEHOLDER = "Write the timeline instruction"
const EVENT_PLACEHOLDER = "Write the event for the timeline"
const YEAR_PLACEHOLDER = "1994"
const HEADING_TEXT = "Configure the correct time and event"
const EVENT = "event"
const YEAR = "year"

/* export interface TimelineEditorExtraProps {} */

export type TimelineEditorProps =
  React.HTMLAttributes<HTMLDivElement> /* & TimelineEditorExtraProps */

const TimelineEditor: React.FC<TimelineEditorProps> = () => {
  const [state, setState] = useState<Timeline[]>([])
  const { t } = useTranslation()

  const handleChange = (e: any) => {
    const id = e.parentElement.id
    const value = e.innerText
    setState((prevState) => {
      return prevState.map((item) => {
        return item.id === id
          ? {
              ...item,
              content: value,
            }
          : item
      })
    })
  }

  return (
    <Wrapper>
      <span>{t("timeline-instruction")}</span>
      <TextField placeholder={PLACEHOLDER} onChange={() => null}></TextField>

      <h2>{HEADING_TEXT}</h2>
      {state &&
        state.map(({ id, content, year }) => (
          <List key={id} id={id}>
            <Date>
              <TextAreaField onChange={handleChange} defaultValue={year} autoResize={true} />
            </Date>
            <Event>
              <TextAreaField onChange={handleChange} defaultValue={content} autoResize={true} />
            </Event>
            <DeleteBtn
              onClick={() => {
                setState((prevState) => {
                  return prevState.filter((o) => {
                    return year !== o.year
                  })
                })
              }}
            >
              <CrossIcon />
            </DeleteBtn>
          </List>
        ))}
      <StyledForm
        onSubmit={(e: React.SyntheticEvent) => {
          e.preventDefault()
          const target = e.target as typeof e.target & {
            year: { value: string }
            event: { value: string }
          }

          const year = target.year.value
          const event = target.event.value

          if (year !== "" && event !== "") {
            setState((state) => [
              ...state,
              {
                // eslint-disable-next-line i18next/no-literal-string
                id: `id-${year}`,
                year: year,
                content: event,
              },
            ])
          }
          target.year.value = ""
          target.event.value = ""
        }}
      >
        <StyledTextField name={YEAR} placeholder={YEAR_PLACEHOLDER} onChange={() => null} />
        <TextField name={EVENT} placeholder={EVENT_PLACEHOLDER} onChange={() => null} />
        <StyledBtn type="submit" name={t("submit")} value={t("submit")}>
          <CrossIcon />
        </StyledBtn>
      </StyledForm>
    </Wrapper>
  )
}

export default TimelineEditor
