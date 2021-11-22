import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useContext } from "react"

import SettingIcon from "../../imgs/setting.svg"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { fontWeights, headingFont, primaryFont } from "../../shared-module/styles"

import Language from "./Language"

const CourseGrid = styled.div`
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
`

const CourseCard = styled.div`
  margin-bottom: 5px;

  position: relative;
  max-width: 450px;
  width: 450px;
  height: 400px;
  background: #ededed;
  border-radius: 1px;
`

const StyledSettingIcon = styled(SettingIcon)`
  position: absolute;
  top: 30px;
  right: 40px;

  :hover {
    cursor: pointer;
  }
`

const CourseContent = styled.div`
  padding: 82px 28px 0px 28px;
`

// eslint-disable-next-line i18next/no-literal-string
const CourseHeading = styled.div`
  font-family: ${headingFont};
  font-weight: ${fontWeights["semibold"]};
  font-size: 28px;
  line-height: 1.25;
  color: #333333;
  margin-bottom: 13px;
`

// eslint-disable-next-line i18next/no-literal-string
const CourseDescription = styled.div`
  font-family: ${primaryFont};
  font-weight: ${fontWeights["normal"]};
  font-size: 16px;
  line-height: 24px;
  color: #3b4754;
`

const CourseLanguageContent = styled.div`
  margin-top: 25px;
  display: flex;
  padding: 0px 28px 0px 28px;
  align-items: center;

  position: absolute;
  bottom: 80px;
`

// eslint-disable-next-line i18next/no-literal-string
const LanguageLabel = styled.div`
  font-family: ${primaryFont};
  font-weight: ${fontWeights["semibold"]};
  color: #333333;
`

// eslint-disable-next-line i18next/no-literal-string
const LanguageCode = styled.div`
  font-family: ${primaryFont};
  font-weight: ${fontWeights["semibold"]};
  color: #898989;
`

const FlagStyle = css`
  width: 45px;
  height: 45px;
  clip-path: circle(25% at 42% 50%);
  margin-left: 35px;
`

interface CourseCardProps {
  title: string
  description: string
  languageCode: string
  onClick: (event: unknown) => unknown
}

const capitalize: (language: string) => string = (language) => {
  return language.charAt(0).toUpperCase() + language.substr(1).toLowerCase()
}

const LANGUAGE_TEXT = "Language"

const CourseComponent: React.FC<CourseCardProps> = ({
  title,
  description,
  languageCode,
  onClick,
}) => {
  const loginStateContext = useContext(LoginStateContext)
  const LanguageComponent = Language[languageCode]

  return (
    <CourseCard>
      {loginStateContext.signedIn && <StyledSettingIcon onClick={onClick} />}
      <CourseContent>
        <CourseHeading> {title} </CourseHeading>
        <CourseDescription>{description}</CourseDescription>
      </CourseContent>
      <CourseLanguageContent>
        <LanguageLabel>{LANGUAGE_TEXT}</LanguageLabel>
        <LanguageComponent.image className={FlagStyle} />
        <LanguageCode>{capitalize(LanguageComponent.humanReadableName)} </LanguageCode>
      </CourseLanguageContent>
    </CourseCard>
  )
}

export { CourseComponent, CourseGrid }
