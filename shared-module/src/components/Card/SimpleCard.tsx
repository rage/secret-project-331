import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import CardSVG from "../../img/cardNext.svg"
import { typography } from "../../styles"
import { cardHeight, cardMaxWidth } from "../../styles/constants"

import { CardExtraProps } from "."

const CourseGridWrapper = styled.a`
  text-decoration: none;
  display: block;
  max-width: ${cardMaxWidth}em;
  height: ${cardHeight}em;
  border-radius: 1px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  background: #48cfad;

  @media (max-width: 600px) {
    height: ${cardHeight * 0.75}em;
  }
`

const CardContentWrapper = styled.div`
  display: flex;
  height: 100%;
  text-align: left;
  flex-direction: column;

  h2 {
    font-size: ${typography.h3};
    font-weight: 700;
    z-index: 20;
    line-height: 1em;
    color: rgba(40, 40, 40, 0.8);
  }

  span {
    color: #333;
    font-size: 1.2em;
    opacity: 0.8;
    z-index: 20;
    font-weight: 500;
    width: 50%;
    line-height: 3em;
  }
  @media (max-width: 37.5em) {
    word-break: break-all;
  }
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const SimpleCard: React.FC<CardProps> = ({ title, chapterNumber, url, open, bg, date, time }) => {
  // If URL defined, the chapter is open

  const fetchOpensText = () => {
    if (date && time) {
      return (
        <>
          <div>AVAILABLE</div>
          <div>
            {date} at {time}
          </div>
        </>
      )
    } else if (time) {
      return (
        <>
          <div>OPENS IN</div>
          <div>{time}</div>
        </>
      )
    } else if (open) {
      return <span>OPENS NOW!</span>
    } else {
      return <span>CLOSED</span>
    }
  }
  return (
    <CourseGridWrapper
      className={css`
        background: ${bg};
      `}
      // Pass href={url} if url defined
      {...(url ? { href: url } : {})}
    >
      <CardContentWrapper>
        {!open && !url ? (
          <div
            className={css`
              flex: 0 1 auto;
              text-align: center;
              background: #cac9c9;
              padding: 2em;
              background-repeat: repeat-x;
              background-position: top -5px center;
              background-image: url("data:image/svg+xml,%3Csvg width='600' height='90' viewBox='0 0 600 90' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='42' y='-10' width='6' height='10'/%3E%3Crect x='84' y='-10' width='6' height='10'/%3E%3Crect x='126' y='-13' width='5' height='13'/%3E%3Crect x='168' y='-13' width='5' height='13'/%3E%3Crect x='210' y='-10' width='6' height='10'/%3E%3Crect x='252' y='-13' width='5' height='13'/%3E%3Crect x='294' y='-10' width='6' height='10'/%3E%3Crect x='336' y='-13' width='5' height='13'/%3E%3Crect x='378' y='-13' width='5' height='13'/%3E%3Crect x='420' y='-10' width='6' height='10'/%3E%3Crect x='462' y='-10' width='6' height='10'/%3E%3Crect x='504' y='-13' width='5' height='13'/%3E%3Crect x='546' y='-10' width='6' height='10'/%3E%3Cstyle type='text/css'%3E rect %7B opacity: 0; %7D rect:nth-child(1) %7B transform-origin: 45px 5px; transform: rotate(-145deg); animation: blast 700ms infinite ease-out; animation-delay: 88ms; animation-duration: 631ms; %7D rect:nth-child(2) %7B transform-origin: 87px 5px; transform: rotate(164deg); animation: blast 700ms infinite ease-out; animation-delay: 131ms; animation-duration: 442ms; %7D rect:nth-child(3) %7B transform-origin: 128px 6px; transform: rotate(4deg); animation: blast 700ms infinite ease-out; animation-delay: 92ms; animation-duration: 662ms; %7D rect:nth-child(4) %7B transform-origin: 170px 6px; transform: rotate(-175deg); animation: blast 700ms infinite ease-out; animation-delay: 17ms; animation-duration: 593ms; %7D rect:nth-child(5) %7B transform-origin: 213px 5px; transform: rotate(-97deg); animation: blast 700ms infinite ease-out; animation-delay: 122ms; animation-duration: 476ms; %7D rect:nth-child(6) %7B transform-origin: 255px 6px; transform: rotate(57deg); animation: blast 700ms infinite ease-out; animation-delay: 271ms; animation-duration: 381ms; %7D rect:nth-child(7) %7B transform-origin: 297px 5px; transform: rotate(-46deg); animation: blast 700ms infinite ease-out; animation-delay: 131ms; animation-duration: 619ms; %7D rect:nth-child(8) %7B transform-origin: 338px 6px; transform: rotate(-65deg); animation: blast 700ms infinite ease-out; animation-delay: 85ms; animation-duration: 668ms; %7D rect:nth-child(9) %7B transform-origin: 380px 6px; transform: rotate(13deg); animation: blast 700ms infinite ease-out; animation-delay: 128ms; animation-duration: 377ms; %7D rect:nth-child(10) %7B transform-origin: 423px 5px; transform: rotate(176deg); animation: blast 700ms infinite ease-out; animation-delay: 311ms; animation-duration: 508ms; %7D rect:nth-child(11) %7B transform-origin: 465px 5px; transform: rotate(108deg); animation: blast 700ms infinite ease-out; animation-delay: 108ms; animation-duration: 595ms; %7D rect:nth-child(12) %7B transform-origin: 506px 6px; transform: rotate(62deg); animation: blast 700ms infinite ease-out; animation-delay: 105ms; animation-duration: 375ms; %7D rect:nth-child(13) %7B transform-origin: 549px 5px; transform: rotate(16deg); animation: blast 700ms infinite ease-out; animation-delay: 149ms; animation-duration: 491ms; %7D rect:nth-child(odd) %7B fill: %2365BB5C; %7D rect:nth-child(even) %7B z-index: 1; fill: %2333AAFF; %7D rect:nth-child(4n) %7B animation-duration: 1400ms; fill: %23F23B14; %7D rect:nth-child(3n) %7B animation-duration: 1750ms; animation-delay: 700ms; %7D rect:nth-child(4n-7) %7B fill: %232A2F6A; %7D rect:nth-child(6n) %7B fill: %23FBBA23; %7D @keyframes blast %7B from %7B opacity: 0; %7D 20%25 %7B opacity: 1; %7D to %7B transform: translateY(90px); %7D %7D %3C/style%3E%3C/svg%3E%0A");
            `}
          >
            {fetchOpensText()}
          </div>
        ) : (
          <div
            className={css`
              flex: 0 1 auto;
              padding: 2em 2.5em 0 2.5em;
            `}
          >
            <CardSVG />
          </div>
        )}
        <div
          className={css`
            flex: 1 1 auto;
            padding: 0em 2.5em 2em 2.5em;
          `}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              height: 100%;
            `}
          >
            <div
              className={css`
                margin-top: auto;
              `}
            >
              <span>{`CHAPTER ${chapterNumber ?? ""}`}</span>
              <h2>{title}</h2>
            </div>
          </div>
        </div>
      </CardContentWrapper>
    </CourseGridWrapper>
  )
}

export default SimpleCard
