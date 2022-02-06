import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import SettingIcon from "../../../../imgs/setting.svg"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import { fontWeights, headingFont, primaryFont } from "../../../../shared-module/styles"

import Language from "./Language"

const CourseGrid = styled.div`
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding-bottom: 10px;
`

const CourseCard = styled.a`
  margin-bottom: 5px;

  position: relative;
  max-width: 100%;
  width: 100%;
  height: 320px;
  background: #f5f6f7;
  border-radius: 3px;
  text-decoration: none;
  border: 1px solid #bec3c7;

  :hover {
    cursor: pointer;
    background: #ebedee;
  }
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
  padding: 60px 28px 0px 40px;
`

// eslint-disable-next-line i18next/no-literal-string
const CourseHeading = styled.div`
  font-family: ${headingFont};
  font-weight: 200;
  font-size: 40px;
  line-height: 1;
  color: #1a2333;
  margin-bottom: 13px;
`

// eslint-disable-next-line i18next/no-literal-string
const CourseDescription = styled.div`
  font-family: ${primaryFont};
  font-weight: ${fontWeights["normal"]};
  font-size: 20px;
  line-height: 24px;
  color: #1a2333;
  opacity: 0.8;
`

const CourseLanguageContent = styled.div`
  margin-top: 25px;
  display: flex;
  padding: 0px 28px 20px 40px;
  align-items: center;

  position: absolute;
  bottom: 20px;
`

// eslint-disable-next-line i18next/no-literal-string
const LanguageLabel = styled.div`
  font-family: ${primaryFont};
  color: #1a2333;
  font-size: 18px;
`

// eslint-disable-next-line i18next/no-literal-string
const LanguageCode = styled.div`
  font-family: ${primaryFont};
  font-weight: ${fontWeights["semibold"]};
  color: #1a2333;
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
  manageHref: string
  navigateToCourseHref: string
}

const capitalizeFirstLetter: (language: string) => string = (language) => {
  return language.charAt(0).toUpperCase() + language.substring(1).toLowerCase()
}

const LANGUAGE_TEXT = "Language"

const CourseComponent: React.FC<CourseCardProps> = ({
  title,
  description,
  languageCode,
  manageHref,
  navigateToCourseHref,
}) => {
  const loginStateContext = useContext(LoginStateContext)
  const LanguageComponent = Language[languageCode]
  const { t } = useTranslation()

  return (
    <CourseCard href={navigateToCourseHref} aria-label={t("course-navigation", { title })}>
      {loginStateContext.signedIn && (
        <a aria-label={t("manage-course", { title })} href={manageHref}>
          <StyledSettingIcon />
        </a>
      )}

      <CourseContent>
        <CourseHeading> {title} </CourseHeading>
        <CourseDescription>{description}</CourseDescription>
      </CourseContent>
      <CourseLanguageContent>
        <LanguageLabel>{LANGUAGE_TEXT}</LanguageLabel>
        <LanguageComponent.image className={FlagStyle} />
        <LanguageCode>{capitalizeFirstLetter(LanguageComponent.humanReadableName)} </LanguageCode>
      </CourseLanguageContent>
    </CourseCard>
  )
}

export { CourseComponent, CourseGrid }
