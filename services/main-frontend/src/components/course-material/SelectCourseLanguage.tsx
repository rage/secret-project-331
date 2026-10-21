"use client"

import { css } from "@emotion/css"
import { LanguageTranslation } from "@vectopus/atlas-icons-react"
import { useAtomValue } from "jotai"
import React, { useCallback, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import useCourseLanguageVersionNavigationInfos from "@/hooks/course-material/useCourseLanguageVersionNavigationInfos"
import { headingFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult, Select } from "@/shared-module/components"
import { currentPageDataAtom } from "@/state/course-material/selectors"

import { getLanguageName } from "./modals/ChooseCourseLanguage"

export interface CourseTranslationsListProps {
  selectedLangCourseId: string
  setSelectedLangCourseId: (setLanguage: string) => void
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

  const { control, watch, setValue } = useForm<{ courseId: string }>({
    defaultValues: { courseId: selectedLangCourseId },
  })
  const formCourseId = watch("courseId")

  const onChange = useCallback(
    (changedCourseId: string) => {
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

  useEffect(() => {
    if (formCourseId !== selectedLangCourseId) {
      onChange(formCourseId)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [formCourseId])

  useEffect(() => {
    setValue("courseId", selectedLangCourseId)
  }, [selectedLangCourseId, setValue])

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
    // i !== -1 was handled above, so index i exists.
    const item = courseLanguageVersionsQuery.data[i]
    if (item === undefined) {
      return courseLanguageVersionsQuery.data.slice()
    }
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

  // The query is disabled when there is no course id, in which case it stays pending forever.
  // Render nothing instead of an infinite loading skeleton.
  if (!currentCourseId) {
    return null
  }

  return (
    <QueryResult query={courseLanguageVersionsQuery}>
      {() => {
        if (reorderedCourseLanguageVersions.length < 2) {
          // The course has only 1 language version, so no need to show the language selection
          return null
        }

        return (
          <div
            className={css`
              display: flex;
              flex-wrap: wrap;
              justify-content: space-between;
              font-family: ${headingFont};
              padding-bottom: 1rem;
              align-items: center;
              gap: 0.5rem;
              max-width: 100%;
            `}
          >
            <LanguageTranslation size={18} />
            <Select
              name="courseId"
              data-testid="change-course-language"
              control={control}
              label={t("choose-preferred-language")}
              options={reorderedCourseLanguageVersions.map((version) => ({
                value: version.course_id,
                label: (
                  <span lang={version.language_code}>{getLanguageName(version.language_code)}</span>
                ),
                textValue: getLanguageName(version.language_code),
              }))}
            />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default withErrorBoundary(SelectCourseLanguage)
