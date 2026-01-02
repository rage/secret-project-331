"use client"
import { css } from "@emotion/css"
import { LanguageTranslation } from "@vectopus/atlas-icons-react"
import { useAtomValue } from "jotai"
import React, { useCallback, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getLanguageName, LanguageDisplay } from "./modals/ChooseCourseLanguage"

import useCourseLanguageVersionNavigationInfos from "@/hooks/course-material/useCourseLanguageVersionNavigationInfos"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import {
  baseTheme,
  fontWeights,
  headingFont,
  primaryFont,
  typography,
} from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { currentPageDataAtom } from "@/state/course-material/selectors"

export interface CourseTranslationsListProps {
  selectedLangCourseId: string
  setSelectedLangCourseId(setLanguage: string): void
  setDialogLanguage: React.Dispatch<React.SetStateAction<string>>
  dialogLanguage: string
  currentPageId: string
}

const SelectCourseLanguage: React.FC<React.PropsWithChildren<CourseTranslationsListProps>> = ({
  selectedLangCourseId,
  setSelectedLangCourseId,
  setDialogLanguage,
  dialogLanguage,
  currentPageId,
}) => {
  const { t } = useTranslation("main-frontend", { lng: dialogLanguage })
  const pageData = useAtomValue(currentPageDataAtom)
  const currentCourseId = pageData?.course_id
  const courseLanguageVersionsQuery = useCourseLanguageVersionNavigationInfos(
    currentCourseId,
    currentPageId,
  )

  const langCode = courseLanguageVersionsQuery.data?.find(
    (courseLanguageVersionNavigationInfo) =>
      courseLanguageVersionNavigationInfo.course_id === selectedLangCourseId,
  )?.language_code

  // Gets courseId and languageCode of the chosen language
  const onChange = useCallback(
    (event: { target: { value: string } }) => {
      const changedCourseId = event.target.value
      const newLangCode = courseLanguageVersionsQuery.data?.find(
        (courseLanguageVersionNavigationInfo) =>
          courseLanguageVersionNavigationInfo.course_id === changedCourseId,
      )?.language_code

      if (newLangCode) {
        setDialogLanguage(newLangCode)
      }

      setSelectedLangCourseId(changedCourseId)
    },
    [courseLanguageVersionsQuery.data, setDialogLanguage, setSelectedLangCourseId],
  )

  //Puts the current course at the top of the list
  const reorderedCourseLanguageVersions = useMemo(() => {
    if (!courseLanguageVersionsQuery.data) {
      return []
    }
    const i = courseLanguageVersionsQuery.data.findIndex(
      (courseLanguageVersionNavigationInfo) =>
        courseLanguageVersionNavigationInfo.course_id === currentCourseId,
    )
    if (i === -1) {
      return courseLanguageVersionsQuery.data.slice()
    }
    const item = courseLanguageVersionsQuery.data[i]
    const reordered = [
      item,
      ...courseLanguageVersionsQuery.data.slice(0, i),
      ...courseLanguageVersionsQuery.data.slice(i + 1),
    ]
    return reordered
  }, [courseLanguageVersionsQuery.data, currentCourseId])

  useEffect(() => {
    if (reorderedCourseLanguageVersions.length > 0 && langCode === "") {
      const firstLanguageVersion = reorderedCourseLanguageVersions[0]
      if (!firstLanguageVersion) {
        return
      }
      setDialogLanguage(firstLanguageVersion.language_code)
    }
  }, [currentCourseId, reorderedCourseLanguageVersions, langCode, setDialogLanguage])

  if (courseLanguageVersionsQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  if (courseLanguageVersionsQuery.isError) {
    return <ErrorBanner variant="readOnly" error={courseLanguageVersionsQuery.error} />
  }

  if (reorderedCourseLanguageVersions.length < 2) {
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
          align-items: center;
          gap: 0.5rem;
          height: 37px;
        `}
      >
        <LanguageTranslation size={18} />
        <select
          className={css`
            box-sizing: border-box;
            background: #ffffff;
            border: 2px solid ${baseTheme.colors.gray[200]};
            width: 119px;
            height: 100%;
          `}
          id="changeLanguage"
          onChange={onChange}
          defaultValue={selectedLangCourseId}
        >
          {reorderedCourseLanguageVersions.map((courseLanguageVersionNavigationInfo) => (
            <option
              key={courseLanguageVersionNavigationInfo.course_id}
              value={courseLanguageVersionNavigationInfo.course_id}
            >
              {getLanguageName(courseLanguageVersionNavigationInfo.language_code)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default withErrorBoundary(SelectCourseLanguage)
