"use client"
import { css } from "@emotion/css"
import { LanguageTranslation } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import languageCodesToNamesList from "../modals/LanguageCodesToNames.json"

import useCourseInfo from "@/hooks/course-material/useCourseInfo"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"

export const formatLanguageVersionsQueryKey = (courseId: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  return `course-${courseId}-language-versions`
}

const useFigureOutNewLangCode = (selectedLangCourseId: string) => {
  const course = useCourseInfo(selectedLangCourseId)
  return course.data?.language_code
}

const getLanguageName = (languageCode: string): string => {
  if (!languageCode) {
    throw new Error("Language code is required")
  }
  const langCode = languageCode.split("-")[0]
  const languageObject = Object.entries(languageCodesToNamesList).find(([k, _]) => {
    return k === langCode
  })
  const nativeLanguageName = languageObject ? languageObject[1].nativeName : ""
  const nativeNameUppercase =
    nativeLanguageName.charAt(0).toUpperCase() + nativeLanguageName.slice(1)
  return nativeNameUppercase
}

const LanguageDisplay: React.FC<{ langCode: string }> = ({ langCode }) => {
  const { t } = useTranslation()
  const languageName = ietfLanguageTagToHumanReadableName(langCode)

  return (
    <div
      id={"language-display"}
      className={css`
        display: flex;
        align-items: center;
        margin-right: 10px;
        margin-top: 3px;
      `}
    >
      <span role="img" aria-label={t("language-icon")}>
        <LanguageTranslation size={18} aria-hidden="true" />
      </span>
      <span
        className={css`
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-left: 6px;
        `}
      >
        {languageName}
      </span>
    </div>
  )
}

export { useFigureOutNewLangCode, getLanguageName, LanguageDisplay }
