import styled from "@emotion/styled"
import React, { useState } from "react"

import UK from "../../img/flags/UK.png"
import SettingIcon from "../../img/setting.svg"
import { headingFont } from "../../styles"
import Confetti from "../Confetti"

import LanguageSelector from "./LanguageSelector"

import { CardExtraProps } from "."

const CourseGridWrapper = styled.div`
  max-width: 450px;
  height: 400px;
  border-radius: 1px;
  background: #ededed;
  padding: 40px 60px 40px 40px;
  position: relative;
  display: grid;
  align-items: center;

  /*   @media (max-width: 600px) {
  } */
`
const Content = styled.div`
  h2 {
    line-height: 1.25;
    margin-bottom: 10px;
  }

  span {
    font-size: 16px;
    line-height: 24px;
  }
`
const StyledConfetti = styled(Confetti)`
  position: absolute !important;
`
const StyledSettingIcon = styled(SettingIcon)`
  position: absolute;
  top: 30px;
  right: 40px;
`
const StyledLanguageSelector = styled(LanguageSelector)`
  position: absolute !important;
`

const Languages = styled.div`
  margin-top: 50px;
  display: flex;
  gap: 40px;
  cursor: pointer;

  div {
    display: flex;
  }

  span {
    font-family: ${headingFont};
    font-size: 18px;
    opacity: 0.7;
  }

  img {
    width: 25px;
    height: 25px;
    border-radius: 100%;
    margin-right: 10px;
  }
`

const Info = styled.p`
  font-family: ${headingFont};
  font-size: 18px;
  color: #1d9cf3;
  line-height: 24px;
  width: 60%;
  margin-top: 1rem;
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const CourseCard: React.FC<CardProps> = ({ title, description }) => {
  const [clicked, setClicked] = useState<boolean>(false)
  // If URL defined, the chapter is open

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setClicked(!clicked)
  }

  return (
    <CourseGridWrapper>
      <StyledConfetti />
      <StyledSettingIcon />
      <Content>
        <h2>{title}</h2>
        <span>{description}</span>
        <Languages onClick={handleClick}>
          <span>Choose language </span>
          <div>
            <img src={UK} alt="flag" />
            <p>English-US</p>
          </div>
        </Languages>
        <Info>Available in over 8+ languages</Info>
      </Content>
      {clicked && <StyledLanguageSelector click={handleClick} />}
    </CourseGridWrapper>
  )
}

export default CourseCard
