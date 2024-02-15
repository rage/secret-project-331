import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useCallback, useContext, useEffect } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../contexts/PageContext"
import { fetchCourseLanguageVersions } from "../services/backend"
import ErrorBanner from "../shared-module/common/components/ErrorBanner"
import Spinner from "../shared-module/common/components/Spinner"
import {
  baseTheme,
  fontWeights,
  headingFont,
  primaryFont,
  typography,
} from "../shared-module/common/styles"
import withErrorBoundary from "../shared-module/common/utils/withErrorBoundary"

import { GetLanguageFlag, getLanguageName } from "./modals/ChooseCourseLanguage"

export interface CourseTranslationsListProps {
  selectedLangCourseId: string
  setSelectedLangCourseId(setLanguage: string): void
  setDialogLanguage: React.Dispatch<React.SetStateAction<string>>
  dialogLanguage: string
}

const SelectCourseLanguage: React.FC<React.PropsWithChildren<CourseTranslationsListProps>> = ({
  selectedLangCourseId,
  setSelectedLangCourseId,
  setDialogLanguage,
  dialogLanguage,
}) => {
  const { t } = useTranslation("course-material", { lng: dialogLanguage })
  const pageState = useContext(PageContext)
  const currentCourseId = pageState.pageData?.course_id
  const useCourseLanguageVersionsList = useQuery({
    queryKey: [formatLanguageVersionsQueryKey(currentCourseId ?? ""), currentCourseId],
    queryFn: () => fetchCourseLanguageVersions(currentCourseId ?? ""),
  })
  const courseVersionsList = useCourseLanguageVersionsList.data?.filter(
    (course) => !course.is_draft,
  )

  const langCode = courseVersionsList?.find(
    (course) => course.id === selectedLangCourseId,
  )?.language_code

  // Gets courseId and languageCode of the chosen language
  const onChange = useCallback(
    (event: { target: { value: string } }) => {
      const changedCourseId = event.target.value
      const newLangCode = courseVersionsList?.find(
        (course) => course.id === changedCourseId,
      )?.language_code

      if (newLangCode) {
        setDialogLanguage(newLangCode)
      }

      setSelectedLangCourseId(changedCourseId)
    },
    [courseVersionsList, setDialogLanguage, setSelectedLangCourseId],
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
      setDialogLanguage(firstLanguageVersion.language_code)
    }
  }, [currentCourseId, courseVersionsList, langCode, setDialogLanguage])

  if (useCourseLanguageVersionsList.isPending) {
    return <Spinner variant="medium" />
  }

  if (useCourseLanguageVersionsList.isError) {
    return <ErrorBanner error={useCourseLanguageVersionsList.error} />
  }

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
          {courseVersionsList?.map((course) => (
            <option key={course.id} value={course.id}>
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
