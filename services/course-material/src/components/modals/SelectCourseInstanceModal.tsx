import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useCallback, useContext, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import {
  fetchCourseInstances,
  fetchCourseLanguageVersions,
  postSaveCourseSettings,
} from "../../services/backend"
import { NewCourseBackgroundQuestionAnswer } from "../../shared-module/bindings"
import Dialog from "../../shared-module/components/Dialog"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import {
  baseTheme,
  fontWeights,
  headingFont,
  primaryFont,
  typography,
} from "../../shared-module/styles"
import SelectCourseInstanceForm from "../forms/SelectCourseInstanceForm"

import {
  FigureOutNewLangCode,
  FigureOutNewUrl,
  GetLanguageFlag,
  GetLanguageName,
} from "./ChooseCourseLanguage"

export const formatLanguageVersionsQueryKey = (courseId: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  return `course-${courseId}-language-versions`
}

export interface CourseTranslationsListProps {
  courseId: string
  setIsLanguageChanged(languageChanged: boolean): void
  setSelectLanguage(setLanguage: string): void
}

export interface CourseInstanceSelectModalProps {
  onClose: () => void
  manualOpen?: boolean
}

const SelectCourseLanguage: React.FC<React.PropsWithChildren<CourseTranslationsListProps>> = ({
  setIsLanguageChanged,
  setSelectLanguage,
}) => {
  const { t } = useTranslation()
  const pageState = useContext(PageContext)
  const currentCourseId = pageState.pageData?.course_id
  const [langCode, setLangCode] = useState("")

  //Gets courseId and languageCode of the chosen language
  const onChange = (event: { target: { value: string } }) => {
    const values = event.target.value.split(",")
    const changedCourseId = values[0]

    setLangCode(values[1])
    setSelectLanguage(changedCourseId)
    if (currentCourseId == changedCourseId) {
      setIsLanguageChanged(false)
    } else {
      setIsLanguageChanged(true)
    }
  }

  const CourseLanguageVersionsList = useQuery(
    [formatLanguageVersionsQueryKey(currentCourseId ?? "")],
    () => fetchCourseLanguageVersions(currentCourseId ?? ""),
  )
  const courseVersionsList = CourseLanguageVersionsList.data

  //Puts the current course at the top of the list
  if (courseVersionsList) {
    const i = courseVersionsList.findIndex((course) => course.id === currentCourseId)
    const item = courseVersionsList[i]
    courseVersionsList.splice(i, 1)
    courseVersionsList.unshift(item)
  }

  useEffect(() => {
    if (courseVersionsList) {
      setLangCode(courseVersionsList[0].language_code)
    }
  }, [currentCourseId, courseVersionsList])

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
              {GetLanguageName(course.language_code)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

const CourseInstanceSelectModal: React.FC<
  React.PropsWithChildren<CourseInstanceSelectModalProps>
> = ({ onClose, manualOpen = false }) => {
  const { i18n, t } = useTranslation()
  const loginState = useContext(LoginStateContext)
  const pageState = useContext(PageContext)
  const dialogTitleId = useId()

  const [selectedLangCourseId, setSelectLanguage] = React.useState(
    pageState.pageData?.course_id ?? "",
  )
  const [languageChanged, setIsLanguageChanged] = React.useState(false)

  const [submitError, setSubmitError] = useState<unknown>()
  const [open, setOpen] = useState(false)

  const getCourseInstances = useQuery(
    ["course-instances"],
    () => fetchCourseInstances(selectedLangCourseId as NonNullable<string>),
    {
      enabled: selectedLangCourseId !== null && open && pageState.state === "ready",
    },
  )

  useEffect(() => {
    getCourseInstances.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLangCourseId])

  const newUrl = FigureOutNewUrl(selectedLangCourseId)
  const newLangcode = FigureOutNewLangCode(selectedLangCourseId)

  useEffect(() => {
    const signedIn = !!loginState.signedIn
    const shouldChooseInstance =
      pageState.state === "ready" && pageState.instance === null && pageState.settings === null
    setOpen((signedIn && shouldChooseInstance) || (signedIn && manualOpen))
  }, [loginState, pageState, manualOpen])

  const handleSubmitAndClose = useCallback(
    async (instanceId: string, backgroundQuestionAnswers: NewCourseBackgroundQuestionAnswer[]) => {
      const LANGUAGE_COOKIE_KEY = "selected-language"
      const newLanguage = newLangcode ?? ""
      const selectedLanguage = newLanguage.split("-")
      i18n.changeLanguage(newLanguage)
      // eslint-disable-next-line i18next/no-literal-string
      document.cookie = `${LANGUAGE_COOKIE_KEY}=${selectedLanguage[0]}; path=/; SameSite=Strict; max-age=31536000;`
      if (languageChanged) {
        window.location.assign(newUrl ?? "")

        return
      }
      try {
        await postSaveCourseSettings(instanceId, {
          background_question_answers: backgroundQuestionAnswers,
        })
        setOpen(false)
        if (pageState.refetchPage) {
          // eslint-disable-next-line i18next/no-literal-string
          console.info("Refetching page because the course instance has changed")
          pageState.refetchPage()
        } else {
          console.warn(
            // eslint-disable-next-line i18next/no-literal-string
            "No refetching the page because there's no refetchPage function in the page context.",
          )
        }
        onClose()
      } catch (e) {
        setSubmitError(e)
      }
    },
    [onClose, pageState, languageChanged, newUrl, newLangcode, i18n],
  )

  if (pageState.pageData?.course_id === null) {
    // No course id
    // eslint-disable-next-line i18next/no-literal-string
    return <ErrorBanner variant={"readOnly"} error={"No course ID defined"} />
  }

  if (!open) {
    return null
  }
  return (
    <Dialog open={open} aria-labelledby={dialogTitleId} closeable={false} noPadding>
      <div
        className={css`
          padding: 2rem 3rem;
        `}
      >
        {!!submitError && <ErrorBanner variant={"readOnly"} error={submitError} />}
        <h1
          className={css`
            font-weight: ${fontWeights.medium};
            font-size: ${typography.h5};
            line-height: 26px;
            margin-bottom: 1rem;
          `}
          id={dialogTitleId}
        >
          {t("title-course-settings")}
        </h1>
        <SelectCourseLanguage
          courseId={pageState.pageData?.course_id ?? ""}
          setSelectLanguage={setSelectLanguage}
          setIsLanguageChanged={setIsLanguageChanged}
        />
        {getCourseInstances.isError && (
          <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
        )}
        {getCourseInstances.isLoading && <Spinner variant={"medium"} />}
        {getCourseInstances.isSuccess && (
          <SelectCourseInstanceForm
            courseInstances={getCourseInstances.data}
            onSubmitForm={handleSubmitAndClose}
            initialSelectedInstanceId={pageState.instance?.id}
            languageChanged={languageChanged}
          />
        )}
      </div>
      {languageChanged && (
        <div
          className={css`
            background: ${baseTheme.colors.green[100]};
            height: 57px;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 0px 0px 4px 4px;
          `}
        >
          <p
            className={css`
              font-family: ${primaryFont};
              font-weight: ${fontWeights.normal};
              font-size: 14px;
              max-width: 300px;
              text-align: center;
              color: ${baseTheme.colors.green[700]};
            `}
          >
            {t("course-language-change-warning")}
          </p>
        </div>
      )}
    </Dialog>
  )
}

export default CourseInstanceSelectModal
