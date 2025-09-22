import { css } from "@emotion/css"
import React, { useCallback, useContext, useEffect } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../contexts/PageContext"

import { GetLanguageFlag, getLanguageName } from "./modals/ChooseCourseLanguage"

import useCourseLanguageVersionNavigationInfos from "@/hooks/useCourseLanguageVersionNavigationInfos"
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
  const { t } = useTranslation("course-material", { lng: dialogLanguage })
  const pageState = useContext(PageContext)
  const currentCourseId = pageState.pageData?.course_id
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
  if (courseLanguageVersionsQuery.data) {
    const i = courseLanguageVersionsQuery.data.findIndex(
      (courseLanguageVersionNavigationInfo) =>
        courseLanguageVersionNavigationInfo.course_id === currentCourseId,
    )
    const item = courseLanguageVersionsQuery.data[i]
    courseLanguageVersionsQuery.data.splice(i, 1)
    courseLanguageVersionsQuery.data.unshift(item)
  }

  useEffect(() => {
    if (courseLanguageVersionsQuery.data && langCode === "") {
      const firstLanguageVersion = courseLanguageVersionsQuery.data[0]
      if (!firstLanguageVersion) {
        return
      }
      setDialogLanguage(firstLanguageVersion.language_code)
    }
  }, [currentCourseId, courseLanguageVersionsQuery.data, langCode, setDialogLanguage])

  if (courseLanguageVersionsQuery.isPending) {
    return <Spinner variant="medium" />
  }

  if (courseLanguageVersionsQuery.isError) {
    return <ErrorBanner variant="readOnly" error={courseLanguageVersionsQuery.error} />
  }

  if (courseLanguageVersionsQuery.data && courseLanguageVersionsQuery.data.length < 2) {
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
        {langCode && GetLanguageFlag(langCode)}
        <select
          className={css`
            box-sizing: border-box;
            background: #ffffff;
            border: 2px solid ${baseTheme.colors.gray[200]};
            width: 119px;
          `}
          id="changeLanguage"
          onChange={onChange}
          defaultValue={selectedLangCourseId}
        >
          {courseLanguageVersionsQuery.data?.map((courseLanguageVersionNavigationInfo) => (
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
