import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import SettingIcon from "../../../../imgs/setting.svg"
import Language, {
  DEFAULT_FLAG_CLIP_PATH,
} from "../../../../shared-module/common/components/LanguageSelection/Language"
import LoginStateContext from "../../../../shared-module/common/contexts/LoginStateContext"
import {
  baseTheme,
  fontWeights,
  headingFont,
  primaryFont,
} from "../../../../shared-module/common/styles"
import { respondToOrLarger } from "../../../../shared-module/common/styles/respond"

const CourseGrid = styled.div`
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  padding-bottom: 10px;

  ${respondToOrLarger.md} {
    grid-template-columns: 1fr 1fr;
  }

  ${respondToOrLarger.xxl} {
    grid-template-columns: 1fr 1fr 1fr;
  }
`

const CourseCard = styled.div`
  margin-bottom: 5px;

  position: relative;
  max-width: 100%;
  width: 100%;
  height: 320px;
  background: #f5f6f7;
  border-radius: 3px;

  border: 1px solid #bec3c7;
  :focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }

  :hover {
    cursor: pointer;
    background: #ebedee;
  }
`

const CourseWrapper = styled.div`
  width: 100%;
  height: 100%;
  background: #f5f6f7;
  :hover {
    cursor: pointer;
    background: #ebedee;
  }
`

const CourseContent = styled.div`
  padding: 60px 28px 0px 40px;
`

// eslint-disable-next-line i18next/no-literal-string
const CourseHeading = styled.div`
  font-family: ${headingFont};
  font-weight: 400;
  font-size: 30px;
  line-height: 1;
  color: #1a2333;
  margin-bottom: 13px;
`

// eslint-disable-next-line i18next/no-literal-string
const CourseDescription = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;

  /* Limit line count to 3 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;

  font-family: ${primaryFont};
  font-weight: ${fontWeights["light"]};
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

interface CourseCardProps {
  title: string
  isDraft: boolean
  description: string
  languageCode: string
  manageHref: string
  navigateToCourseHref: string
  id: string
  showManageButton: boolean
}

const capitalizeFirstLetter: (language: string) => string = (language) => {
  return language.charAt(0).toUpperCase() + language.substring(1).toLowerCase()
}

const LANGUAGE_TEXT = "Language"

const CourseComponent: React.FC<React.PropsWithChildren<CourseCardProps>> = ({
  title,
  isDraft,
  description,
  languageCode,
  manageHref,
  navigateToCourseHref,
  showManageButton,
}) => {
  const loginStateContext = useContext(LoginStateContext)
  const LanguageComponent = Language[languageCode]
  const { t } = useTranslation()

  return (
    <CourseCard>
      {loginStateContext.signedIn && showManageButton && (
        <a
          className={css`
            :focus-visible > * {
              outline: 2px solid ${baseTheme.colors.green[500]};
              outline-offset: 2px;
            }
            outline: none;
            position: absolute;
            top: 30px;
            right: 40px;
            opacity: 0.6;

            :hover {
              cursor: pointer;
              opacity: 1;
            }
          `}
          aria-label={t("manage-course", { title })}
          href={manageHref}
        >
          <SettingIcon />
        </a>
      )}

      <CourseWrapper>
        <a
          href={navigateToCourseHref}
          aria-label={t("course-navigation", { title })}
          className={css`
            display: block;
            width: 100%;
            height: 100%;
            text-decoration: none;
          `}
        >
          <CourseContent>
            <CourseHeading>
              {title}
              {isDraft && ` (${t("draft")})`}
            </CourseHeading>
            <CourseDescription>{description}</CourseDescription>
          </CourseContent>
          <CourseLanguageContent>
            <LanguageLabel>{LANGUAGE_TEXT}</LanguageLabel>
            {LanguageComponent && (
              <LanguageComponent.image
                className={css`
                  width: 45px;
                  height: 45px;
                  clip-path: ${LanguageComponent.clipPath ?? DEFAULT_FLAG_CLIP_PATH};
                  margin-left: 35px;
                `}
              />
            )}
            <LanguageCode>
              {LanguageComponent ? (
                capitalizeFirstLetter(LanguageComponent.humanReadableName)
              ) : (
                <span
                  className={css`
                    margin-left: 1rem;
                  `}
                >
                  {languageCode}
                </span>
              )}
            </LanguageCode>
          </CourseLanguageContent>
        </a>
      </CourseWrapper>
    </CourseCard>
  )
}

export { CourseComponent, CourseGrid }
