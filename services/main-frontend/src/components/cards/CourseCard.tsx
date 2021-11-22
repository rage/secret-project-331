import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useContext } from "react"

import SettingIcon from "../../imgs/setting.svg"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { headingFont } from "../../shared-module/styles"

import Language from "./Language"

interface CardExtraProps {
  title: string
  description: string
  languageCode: string
  onClick: (event: unknown) => unknown
}

const CourseGridWrapper = styled.div`
  max-width: 450px;
  height: 400px;
  border-radius: 1px;
  background: #ededed;
  padding: 0px 60px 40px 40px;
  position: relative;
  display: grid;
  align-items: center;
`
const CourseHeader = styled.h2`
  color: #333333;
  line-height: 1.25;
  margin-bottom: 10px;
  font-family: ${headingFont};
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
  color: #ededed;

  :hover {
    cursor: pointer;
  }
`

const LanguageSection = styled.div`
  bottom: 30px;
  position: absolute;
  width: 80%;
`

const LanguageName = styled.span`
  float: left;
`

const FlagStyle = css`
  width: 25px;
  height: 25px;
  border-radius: 50%;
  display: inline;
  float: right;
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const CourseCard: React.FC<CardProps> = ({ title, description, languageCode, onClick }) => {
  // If URL defined, the chapter is open
  const loginStateContext = useContext(LoginStateContext)

  const capitalize: (language: string) => string = (language) => {
    return language.charAt(0).toUpperCase() + language.substr(1).toLowerCase()
  }

  const LanguageComponent = Language[languageCode]

  return (
    <CourseGridWrapper>
      {loginStateContext.signedIn && <StyledSettingIcon onClick={onClick} />}
      <div>
        <CourseHeader>{title}</CourseHeader>
        <CourseDescription>{description}</CourseDescription>
        <LanguageSection>
          <LanguageName>{capitalize(LanguageComponent.humanReadableName)}</LanguageName>
          <LanguageComponent.image className={FlagStyle} />
        </LanguageSection>
      </div>
    </CourseGridWrapper>
  )
}

export default CourseCard
