import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import Finland from "../../imgs/flags/Finland.svg"
import SettingIcon from "../../imgs/setting.svg"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"

import Language from "./Language"

interface CardExtraProps {
  title: string
  description: string
  languageCode: string
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
const CourseHeader = styled.h2`
  color: #333333;
  line-height: 1.25;
  margin-bottom: 10px;
`

const CourseDescription = styled.p`
  color: #3b4754;
  font-size: 16px;
  line-height: 24px;
`

const StyledSettingIcon = styled(SettingIcon)`
  position: absolute;
  top: 30px;
  right: 40px;
`

const FlagStyle = css`
  width: 25px;
  height: 25px;
  border-radius: 50%;
  display: inline;
  float: right;
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const CourseCard: React.FC<CardProps> = ({ title, description, languageCode }) => {
  // If URL defined, the chapter is open
  const loginStateContext = useContext(LoginStateContext)

  const capitalize: (language: string) => string = (language) => {
    return language.charAt(0).toUpperCase() + language.substr(1).toLowerCase()
  }

  const LanguageComponent = Language[languageCode]

  return (
    <CourseGridWrapper>
      {loginStateContext.signedIn && <StyledSettingIcon />}
      <div>
        <CourseHeader>{title}</CourseHeader>
        <CourseDescription>{description}</CourseDescription>
        <div>{capitalize(LanguageComponent.humanReadableName)}</div>
        <LanguageComponent.image className={FlagStyle} />
      </div>
    </CourseGridWrapper>
  )
}

export default CourseCard
