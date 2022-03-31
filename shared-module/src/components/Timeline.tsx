/* eslint-disable i18next/no-literal-string */
import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"

import SelectField from "../components/InputFields/SelectField"
import { baseTheme } from "../styles"

/* export interface TimelineExtraProps {} */

export type TimelineProps = React.HTMLAttributes<HTMLDivElement> /* & TimelineExtraProps */

const options = [
  {
    value: "The UN Conference on Environment and Development (UNCED), Rio de Janeiro",
    label: "The UN Conference on Environment and Development (UNCED), Rio de Janeiro",
  },
  {
    value: "The establishment of the UN Commission on Sustainable Development",
    label: "The establishment of the UN Commission on Sustainable Development",
  },
  {
    value: "The World Summit on Sustainable Development (WSSD), Johannesburg",
    label: "The World Summit on Sustainable Development (WSSD), Johannesburg",
  },
  { value: "Rio +5 conference, New York", label: "Rio +5 conference, New York" },
  {
    value:
      "UN 2030 Agenda for Sustainable Development is accepted & Sustainable Development Goals introducede",
    label:
      "UN 2030 Agenda for Sustainable Development is accepted & Sustainable Development Goals introduced",
  },
  { value: "The New York Summit", label: "The New York Summit" },
  { value: "Our Common Future report published", label: "Our Common Future report published" },
  {
    value: "The establishment of the United Nations Environment Programme (UNEP)",
    label: "The establishment of the United Nations Environment Programme (UNEP)",
  },
]

const TimelineWrapper = styled.section<TimelineProps>`
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
    background: #333333;
    top: 0;
    bottom: 0;
    left: 50%;
    margin-left: -1px;
  }
`
const container = css`
  padding: 15px 30px;
  position: relative;
  background: inherit;
  width: 50%;

  .date {
    position: absolute;
    display: inline-block;
    top: calc(50% - 8px);
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
    border-radius: 0 500px 500px 0;
  }
`
const left = css`
  left: 0;

  .date {
    right: -75px;
  }
`
const right = css`
  left: 50%;

  .date {
    left: -75px;
  }

  .content {
    padding: 30px 30px 30px 30px;
    border-radius: 500px 0 0 500px;
  }

  &::after {
    left: -15px;
  }
`
const StyledTime = styled.div`
  background-color: #e5e0f1;
  border: none;
  margin: 0;
  width: 100%;
  display: flex;
  justisty-content: space-between;
`
const StyledButton = styled.div`
  background-color: #b1a2d4;
  width: 80px;
  justify-self: end;
  height: auto;
  margin: 0;
  position: relative;
  border: none;

  /* &:after {
    content: "+";
    color: #333;
    position: absolute;
    font-size: 3rem;
    line-height: 0.5;
    top: 18px;
    left: 15px;
    font-weight: 200;
    padding-bottom: 5px;
    transform: rotate(45deg);
  } */
`

export interface Time {
  id: string
  date: string
  text: string
}

const Timeline: React.FC<TimelineProps> = (props) => {
  const defaultState = [
    {
      id: "1",
      date: "1920",
      text: "The UN Conference on Environment and Development (UNCED), Rio de Janeiro",
    },
    { id: "2", date: "1921", text: "" },
    { id: "3", date: "1922", text: "" },
    { id: "4", date: "1923", text: "" },
  ]
  const [state, setState] = useState<Time[]>(defaultState)

  const handleOnBlur = (e) => {
    e.preventDefault()
    const targetId = e.target.id
    const content = e.target.value

    setState((prevState) => {
      return prevState.map((item) => (item.id === targetId ? { ...item, text: content } : item))
    })
  }
  const handleClick = (e) => {
    e.preventDefault()
    console.log("I am here", e)
    const targetId = e.target.parentElement.id

    setState((prevState) => {
      return prevState.map((item) => (item.id === targetId ? { ...item, text: "" } : item))
    })
  }

  return (
    <TimelineWrapper {...props}>
      {state.map(({ id, date, text }) => {
        const align = Number(id) % 2 === 0 ? right : left
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
                background: ${text ? "#32BEA6" : "#EBEDEE"};
                border: 2px solid ${text ? "#EBEDEE" : "#767B85"};
                border-style: ${text ? "none" : "dashed"};
                border-radius: 16px;
                z-index: 1;
              }
            `}`}
            /* {cx(container, align)} */ key={id}
          >
            <div className="date">{date}</div>
            <div className="content">
              {text === "" && (
                <SelectField
                  id={id}
                  options={options}
                  onChange={() => null}
                  onBlur={(event) => handleOnBlur(event)}
                />
              )}
              {text && (
                <StyledTime id={id}>
                  <p
                    className={css`
                      padding: 8px 2px 8px 8px;
                      width: 100%;
                    `}
                  >
                    {text}
                  </p>
                  <StyledButton onClick={handleClick}></StyledButton>
                </StyledTime>
              )}
            </div>
          </div>
        )
      })}
    </TimelineWrapper>
  )
}

export default Timeline
