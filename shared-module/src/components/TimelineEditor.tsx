/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import React, { useState } from "react"

import CrossIcon from "../img/exist-icon.svg"

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
`
const StyledTextField = styled(TextField)`
  /* input {
    min-width: 80px !important;
  } */
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
`
const DeleteBtn = styled.button`
  width: 50px;
  height: 100%;
  background: #e2c2bc;
  outline: none;
  justify-self: end;
  border: none;
`
const List = styled.div`
  display: grid;
  grid-template-columns: 0.1fr 2.2fr 0.1fr;
  min-height: 40px;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 20px;
`
const Date = styled.div`
  background: #f5f6f7;
  border: 1.5px solid #e2e4e6;
  width: 280px;
  display: flex;
  padding: 0 1rem;
`
const Event = styled.div`
  background: #f5f6f7;
  border: 1.5px solid #e2e4e6;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  word-wrap: break-word;
  word-break: break-all;
`
export interface Timeline {
  year: string
  content: string
}

/* export interface TimelineEditorExtraProps {} */

export type TimelineEditorProps =
  React.HTMLAttributes<HTMLDivElement> /* & TimelineEditorExtraProps */

const TimelineEditor: React.FC<TimelineEditorProps> = () => {
  const [state, setState] = useState<Timeline[]>([])
  return (
    <Wrapper>
      <span>Timeline instruction</span>
      <TextField placeholder="Write the timeline instruction " onChange={() => null}></TextField>

      <h2>Configure the correct time and event</h2>
      {state &&
        state.map((item) => (
          <List key={item.year}>
            <Date>{item.year}</Date>
            <Event>{item.content}</Event>
            <DeleteBtn
              onClick={() => {
                setState((prevState) => {
                  return prevState.filter((o) => {
                    return item.year !== o.year
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
                year: year,
                content: event,
              },
            ])
          }
          target.year.value = ""
          target.event.value = ""
        }}
      >
        <StyledTextField name="year" placeholder="Year" onChange={() => null} />
        <TextField
          name="event"
          placeholder="Write the timeline instruction "
          onChange={() => null}
        />
        <StyledBtn type="submit" name="submit" value="submit">
          <CrossIcon />
        </StyledBtn>
      </StyledForm>
    </Wrapper>
  )
}

export default TimelineEditor
