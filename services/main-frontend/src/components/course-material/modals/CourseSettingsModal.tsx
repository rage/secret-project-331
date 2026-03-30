"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import React, { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import SelectCourseLanguage from "../SelectCourseLanguage"
import SelectCourseInstanceForm from "../forms/SelectCourseInstanceForm"

import { getLanguageName } from "./ChooseCourseLanguage"

import useLanguageNavigation from "@/hooks/course-material/language/useLanguageNavigation"
import useCourse from "@/hooks/course-material/useCourse"
import useCourseInstances from "@/hooks/course-material/useCourseInstances"
import { refetchUserChapterLocks } from "@/hooks/course-material/useUserChapterLocks"
import useUserMarketingConsent from "@/hooks/course-material/useUserMarketingConsent"
import { postSaveCourseSettings } from "@/services/course-material/backend"
import { NewCourseBackgroundQuestionAnswer } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, fontWeights, primaryFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { invalidateCourseMaterialStateQueries } from "@/state/course-material/queries"
import {
  currentCourseIdAtom,
  currentPageIdAtom,
  materialInstanceAtom,
  materialSettingsAtom,
  viewStatusAtom,
} from "@/state/course-material/selectors"
import { useChangeCourseMaterialLanguage } from "@/utils/course-material/languageHelpers"

export interface CourseSettingsModalProps {
  onClose: () => void
  manualOpen?: boolean
  shouldChooseInstance?: boolean
}

const CourseSettingsModal: React.FC<React.PropsWithChildren<CourseSettingsModalProps>> = ({
  onClose,
  manualOpen = false,
  shouldChooseInstance = false,
}) => {
  const queryClient = useQueryClient()
  const { i18n } = useTranslation()
  const [dialogLanguage, setDialogLanguage] = useState(i18n.language)
  const { t } = useTranslation("main-frontend", { lng: dialogLanguage })
  const loginState = useContext(LoginStateContext)
  const pageId = useAtomValue(currentPageIdAtom)
  const courseId = useAtomValue(currentCourseIdAtom)
  const materialSettings = useAtomValue(materialSettingsAtom)
  const viewStatus = useAtomValue(viewStatusAtom)
  const materialInstance = useAtomValue(materialInstanceAtom)

  // i18n.language changes automatically when the page is loaded, need to update dialogLanguage automatically so that we can accurately detect when the user has changed the language
  useEffect(() => {
    setDialogLanguage((prevState) => {
      if (prevState !== i18n.language) {
        return i18n.language
      }
      return prevState
    })
  }, [i18n.language])

  const savedOrDefaultLangCourseId = materialSettings?.current_course_id ?? courseId ?? null

  const [selectedLangCourseId, setSelectedLangCourseId] = useState<string | null>(
    savedOrDefaultLangCourseId,
  )

  const [submitError, setSubmitError] = useState<unknown>()
  const [open, setOpen] = useState(manualOpen)
  const sortInstances = () => {
    getCourseInstances.data?.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
  }

  const getCourseInstances = useCourseInstances(selectedLangCourseId, {
    enabled: open && viewStatus === "ready",
  })
  sortInstances()

  const courseQuery = useCourse(selectedLangCourseId)
  const askMarketingConsent = courseQuery.data?.ask_marketing_consent

  const userMarketingConsentQuery = useUserMarketingConsent(selectedLangCourseId)
  const checkUserMarketingConsent = userMarketingConsentQuery.data?.email_subscription_in_mailchimp

  useEffect(() => {
    getCourseInstances.refetch()
    sortInstances()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLangCourseId])

  const { availableLanguages } = useLanguageNavigation({
    currentCourseId: courseId,
    currentPageId: pageId,
  })
  const changeCourseMaterialLanguage = useChangeCourseMaterialLanguage()

  const newLangcode = availableLanguages?.find(
    (lang) => lang.courseId === selectedLangCourseId,
  )?.code

  useEffect(() => {
    const signedIn = !!loginState.signedIn

    setOpen(
      (signedIn && shouldChooseInstance) ||
        (signedIn && manualOpen) ||
        (signedIn && askMarketingConsent === true && checkUserMarketingConsent === "unsubscribed"),
    )
  }, [loginState, manualOpen, shouldChooseInstance, askMarketingConsent, checkUserMarketingConsent])

  const languageChanged = savedOrDefaultLangCourseId !== selectedLangCourseId

  const handleSubmitAndCloseMutation = useToastMutation<
    unknown,
    unknown,
    { instanceId: string; backgroundQuestionAnswers: NewCourseBackgroundQuestionAnswer[] }
  >(
    async (variables) => {
      const newLanguage = newLangcode ?? ""

      try {
        await postSaveCourseSettings(variables.instanceId, {
          background_question_answers: variables.backgroundQuestionAnswers,
        })

        if (newLanguage) {
          changeCourseMaterialLanguage(newLanguage)
        }

        await invalidateCourseMaterialStateQueries(queryClient, courseId)
        await refetchUserChapterLocks(queryClient, courseId)

        // The redirect will be handled by useCourseMaterialLanguageRedirection hook
        // after changeCourseMaterialLanguage updates the atom

        setOpen(false)

        onClose()
      } catch (e) {
        setSubmitError(e)
      }
      return null
    },
    { notify: false },
  )

  if (courseId === null) {
    // eslint-disable-next-line i18next/no-literal-string
    return <ErrorBanner variant={"readOnly"} error={"No course ID defined"} />
  }

  if (!open) {
    return null
  }
  return (
    <StandardDialog
      open={open}
      title={t("title-course-settings")}
      noPadding
      leftAlignTitle={true}
      showCloseButton={false}
      closeable={false}
    >
      <div
        className={css`
          padding: 2rem 3rem;
        `}
      >
        {!!submitError && <ErrorBanner variant={"readOnly"} error={submitError} />}
        {pageId && selectedLangCourseId && (
          <SelectCourseLanguage
            selectedLangCourseId={selectedLangCourseId}
            setSelectedLangCourseId={setSelectedLangCourseId}
            setDialogLanguage={setDialogLanguage}
            dialogLanguage={dialogLanguage}
            currentPageId={pageId}
          />
        )}
        {getCourseInstances.isError && (
          <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
        )}
        {getCourseInstances.isLoading && <Spinner variant={"medium"} />}
        {getCourseInstances.isSuccess && selectedLangCourseId && (
          <SelectCourseInstanceForm
            courseInstances={getCourseInstances.data}
            submitMutation={handleSubmitAndCloseMutation}
            initialSelectedInstanceId={
              materialSettings?.current_course_instance_id ?? materialInstance?.id
            }
            dialogLanguage={dialogLanguage}
            selectedLangCourseId={selectedLangCourseId}
          />
        )}
      </div>

      {languageChanged && (
        <div
          className={css`
            background: ${baseTheme.colors.green[100]};
            min-height: 57px;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0.75rem 1rem;
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
              margin: 0;
            `}
          >
            {t("course-language-change-warning", {
              newLanguage: getLanguageName(newLangcode ?? ""),
            })}
          </p>
        </div>
      )}
    </StandardDialog>
  )
}

export default withErrorBoundary(CourseSettingsModal)
