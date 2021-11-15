import styled from "@emotion/styled"
import Image from "next/image"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Finland from "../../imgs/flags/Finland.png"
import SettingIcon from "../../imgs/setting.svg"

import LanguageSelector from "./LanguageSelector"

interface CardExtraProps {
  title: string
  description: string
}

const CourseGridWrapper = styled.div`
  max-width: 450px;
  height: 400px;
  border-radius: 1px;
  background: #ededed;
  padding: 40px 60px 40px 40px;
  position: relative;
  display: grid;
  align-items: center;
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
const StyledSettingIcon = styled(SettingIcon)`
  position: absolute;
  top: 30px;
  right: 40px;
`
const StyledLanguageSelector = styled(LanguageSelector)`
  position: absolute !important;
  top: 0px;
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
    font-family: "Josefin Sans", sans-serif;
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
  font-family: "Josefin Sans", sans-serif;
  font-size: 18px;
  color: #1d9cf3;
  line-height: 24px;
  width: 60%;
  margin-top: 1rem;
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const CourseCard: React.FC<CardProps> = ({ title, description }) => {
  const { t } = useTranslation()
  const [clicked, setClicked] = useState<boolean>(false)
  // If URL defined, the chapter is open

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setClicked(!clicked)
  }

  return (
    <CourseGridWrapper>
      <StyledSettingIcon />
      <Content>
        <h2>{title}</h2>
        <span>{description}</span>
        <Languages onClick={handleClick}>
          <span>{t("choose-a-language")}</span>
          <div>
            <Image src={Finland} alt={t("finnish")} />
            <p>{t("american-english")}</p>
          </div>
        </Languages>
        <Info>{t("available-in-languages", { num: 8 })}</Info>
      </Content>
      {clicked && <StyledLanguageSelector click={handleClick} />}
    </CourseGridWrapper>
  )
}

export { CourseGridWrapper, CourseCard }
