import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"

import SelectField from "../components/TimelineSelect"

interface T {
  value: string
  label: string
}

export interface TimelineExtraProps {
  data: T[]
}

export type TimelineProps = React.HTMLAttributes<HTMLDivElement> & TimelineExtraProps

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
      text: "",
    },
    { id: "2", date: "1921", text: "" },
    { id: "3", date: "1922", text: "" },
    { id: "4", date: "1923", text: "" },
  ]
  const [state, setState] = useState<Time[]>(defaultState)

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault()
    const targetId = e.target.id
    const content = e.target.value

    setState((prevState) => {
      return prevState.map((item) => (item.id === targetId ? { ...item, text: content } : item))
    })
  }
  const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.preventDefault()
    const target = event.target as HTMLInputElement
    const targetId = target.parentElement?.id

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
                border: ${text ? "4px solid #EBEDEE" : "2px solid #767B85"};
                border-style: ${text ? "solid" : "dashed"};
                border-radius: 16px;
                transition: all 200ms linear;
                z-index: 1;
              }
            `}`}
            key={id}
          >
            <div className="date">{date}</div>
            <div className="content">
              {text === "" && (
                <SelectField
                  id={id}
                  options={props.data}
                  onChange={(event) => handleChange(event)}
                />
              )}
              {text && (
                <div id={id}>
                  <p
                    className={css`
                      padding: 8px 2px 8px 8px;
                      width: 100%;
                    `}
                  >
                    {text}
                  </p>
                  <StyledButton onClick={handleClick}></StyledButton>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </TimelineWrapper>
  )
}

export default Timeline
