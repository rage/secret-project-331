import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../contexts/PageContext"
import { fetchCourseLanguageVersions } from "../services/backend"
import {
  baseTheme,
  fontWeights,
  headingFont,
  primaryFont,
  typography,
} from "../shared-module/styles"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"

import { GetLanguageFlag, getLanguageName } from "./modals/ChooseCourseLanguage"

export interface CourseTranslationsListProps {
  courseId: string
  setIsLanguageChanged(languageChanged: boolean): void
  setSelectLanguage(setLanguage: string): void
}

const SelectCourseLanguage: React.FC<React.PropsWithChildren<CourseTranslationsListProps>> = ({
  setIsLanguageChanged,
  setSelectLanguage,
}) => {
  const { t } = useTranslation()
  const pageState = useContext(PageContext)
  const currentCourseId = pageState.pageData?.course_id
  const [langCode, setLangCode] = useState("")
  const { i18n } = useTranslation()

  //Gets courseId and languageCode of the chosen language
  const onChange = (event: { target: { value: string } }) => {
    const values = event.target.value.split(",")
    const changedCourseId = values[0]

    setLangCode(values[1])
    i18n.changeLanguage(values[1])
    setSelectLanguage(changedCourseId)
    if (currentCourseId == changedCourseId) {
      setIsLanguageChanged(false)
    } else {
      setIsLanguageChanged(true)
    }
  }

  const useCourseLanguageVersionsList = useQuery(
    [formatLanguageVersionsQueryKey(currentCourseId ?? "")],
    () => fetchCourseLanguageVersions(currentCourseId ?? ""),
  )
  const courseVersionsList = useCourseLanguageVersionsList.data?.filter(
    (course) => !course.is_draft,
  )

  //Puts the current course at the top of the list
  if (courseVersionsList) {
    const i = courseVersionsList.findIndex((course) => course.id === currentCourseId)
    const item = courseVersionsList[i]
    courseVersionsList.splice(i, 1)
    courseVersionsList.unshift(item)
  }

  useEffect(() => {
    if (courseVersionsList && langCode === "") {
      const firstLanguageVersion = courseVersionsList[0]
      if (!firstLanguageVersion) {
        return
      }
      i18n.changeLanguage(firstLanguageVersion.language_code)
      setLangCode(firstLanguageVersion.language_code)
    }
  }, [currentCourseId, courseVersionsList, langCode, i18n])

  if (courseVersionsList && courseVersionsList.length < 2) {
    // The course has only 1 language version, so no need to show the language selection
    return null
  }

  return (
    <div
      className={css`
        display: flex;
        justify-content: space-between;
        font-family: ${headingFont};
        padding-bottom: 1rem;
        align-items: center;
      `}
    >
      <label
        htmlFor="changeLanguage"
        className={css`
          font-family: ${primaryFont};
          font-weight: ${fontWeights.normal};
          font-size: ${typography.h6};
          color: ${baseTheme.colors.gray[500]};
        `}
      >
        {t("choose-preferred-language")}
      </label>

      <div
        className={css`
          display: flex;
          height: 37px;
        `}
      >
        {GetLanguageFlag(langCode)}
        <select
          className={css`
            box-sizing: border-box;
            background: #ffffff;
            border: 2px solid ${baseTheme.colors.gray[200]};
            width: 119px;
          `}
          id="changeLanguage"
          onChange={onChange}
        >
          {courseVersionsList?.map((course) => (
            <option key={course.id} value={[course.id, course.language_code]}>
              {getLanguageName(course.language_code)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export const formatLanguageVersionsQueryKey = (courseId: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  return `course-${courseId}-language-versions`
}

export default withErrorBoundary(SelectCourseLanguage)
