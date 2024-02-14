import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/router"
import React, { useContext, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import { fetchCourseInstances, postSaveCourseSettings } from "../../services/backend"
import { NewCourseBackgroundQuestionAnswer } from "../../shared-module/bindings"
import Dialog from "../../shared-module/components/Dialog"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import { baseTheme, fontWeights, primaryFont, typography } from "../../shared-module/styles"
import { LANGUAGE_COOKIE_KEY } from "../../shared-module/utils/constants"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import SelectCourseLanguage from "../SelectCourseLanguage"
import SelectCourseInstanceForm from "../forms/SelectCourseInstanceForm"

import {
  getLanguageName,
  useFigureOutNewLangCode,
  useFigureOutNewUrl,
} from "./ChooseCourseLanguage"

export interface CourseTranslationsListProps {
  courseId: string
  setIsLanguageChanged(languageChanged: boolean): void
  setSelectLanguage(setLanguage: string): void
}

export interface CourseSettingsModalProps {
  onClose: () => void
  manualOpen?: boolean
}

const CourseSettingsModal: React.FC<React.PropsWithChildren<CourseSettingsModalProps>> = ({
  onClose,
  manualOpen = false,
}) => {
  const queryClient = useQueryClient()
  const { i18n } = useTranslation()
  const [dialogLanguage, setDialogLanguage] = useState(i18n.language)
  const { t } = useTranslation("course-material", { lng: dialogLanguage })
  const loginState = useContext(LoginStateContext)
  const pageState = useContext(PageContext)
  const dialogTitleId = useId()
  const router = useRouter()

  const [selectedLangCourseId, setSelectedLangCourseId] = React.useState(
    pageState.settings?.current_course_id ?? pageState.pageData?.course_id ?? "",
  )

  const [submitError, setSubmitError] = useState<unknown>()
  const [open, setOpen] = useState(manualOpen)
  const sortInstances = () => {
    getCourseInstances.data?.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
  }

  const getCourseInstances = useQuery({
    queryKey: ["course-instances", selectedLangCourseId],
    queryFn: () => fetchCourseInstances(selectedLangCourseId as NonNullable<string>),
    enabled: selectedLangCourseId !== null && open && pageState.state === "ready",
  })
  sortInstances()

  useEffect(() => {
    getCourseInstances.refetch()
    sortInstances()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLangCourseId])

  const newUrl = useFigureOutNewUrl(
    selectedLangCourseId,
    pageState.pageData?.page_language_group_id ?? null,
  )
  const newLangcode = useFigureOutNewLangCode(selectedLangCourseId)

  useEffect(() => {
    const signedIn = !!loginState.signedIn
    const shouldChooseInstance =
      pageState.state === "ready" && pageState.instance === null && pageState.settings === null

    setOpen((signedIn && shouldChooseInstance) || (signedIn && manualOpen))
  }, [loginState, pageState, manualOpen])

  const handleSubmitAndCloseMutation = useToastMutation<
    unknown,
    unknown,
    { instanceId: string; backgroundQuestionAnswers: NewCourseBackgroundQuestionAnswer[] }
  >(
    async (variables) => {
      const newLanguage = newLangcode ?? ""
      const languageChanged = i18n.language === newLanguage
      i18n.changeLanguage(newLanguage)
      // eslint-disable-next-line i18next/no-literal-string
      document.cookie = `${LANGUAGE_COOKIE_KEY}=${newLanguage}; path=/; SameSite=Strict; max-age=31536000;`

      try {
        await postSaveCourseSettings(variables.instanceId, {
          background_question_answers: variables.backgroundQuestionAnswers,
        })

        await queryClient.invalidateQueries()
        if (languageChanged && newUrl) {
          await router.push(newUrl)
        }

        if (pageState.refetchPage) {
          // eslint-disable-next-line i18next/no-literal-string
          console.info("Refetching page because the course instance has changed")
          await pageState.refetchPage()
        } else {
          console.warn(
            // eslint-disable-next-line i18next/no-literal-string
            "No refetching the page because there's no refetchPage function in the page context.",
          )
        }

        setOpen(false)

        onClose()
      } catch (e) {
        setSubmitError(e)
      }
      return null
    },
    { notify: false },
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
          selectedLangCourseId={selectedLangCourseId}
          setSelectedLangCourseId={setSelectedLangCourseId}
          setDialogLanguage={setDialogLanguage}
          dialogLanguage={dialogLanguage}
        />
        {getCourseInstances.isError && (
          <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
        )}
        {getCourseInstances.isPending && <Spinner variant={"medium"} />}
        {getCourseInstances.isSuccess && (
          <SelectCourseInstanceForm
            courseInstances={getCourseInstances.data}
            submitMutation={handleSubmitAndCloseMutation}
            initialSelectedInstanceId={
              pageState.settings?.current_course_instance_id ?? pageState.instance?.id
            }
            languageChanged={i18n.language === dialogLanguage}
            dialogLanguage={dialogLanguage}
          />
        )}
      </div>
      {i18n.language !== dialogLanguage && (
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
              max-width: 400px;
              line-height: 17px;
              text-align: center;
              color: ${baseTheme.colors.green[700]};
            `}
          >
            {t("course-language-change-warning", {
              newLanguage: getLanguageName(newLangcode ?? ""),
            })}
          </p>
        </div>
      )}
    </Dialog>
  )
}

export default withErrorBoundary(CourseSettingsModal)
