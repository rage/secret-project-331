import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useCallback, useContext, useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import { fetchCourseInstances, postSaveCourseSettings } from "../../services/backend"
import { NewCourseBackgroundQuestionAnswer } from "../../shared-module/bindings"
import Dialog from "../../shared-module/components/Dialog"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import SelectCourseInstanceForm from "../forms/SelectCourseInstanceForm"

export interface CourseInstanceSelectModalProps {
  onClose: () => void
  manualOpen?: boolean
}

const CourseInstanceSelectModal: React.FC<
  React.PropsWithChildren<CourseInstanceSelectModalProps>
> = ({ onClose, manualOpen = false }) => {
  const { t } = useTranslation()
  const loginState = useContext(LoginStateContext)
  const pageState = useContext(PageContext)
  const dialogTitleId = useId()

  const [submitError, setSubmitError] = useState<unknown>()
  const [open, setOpen] = useState(false)
  const getCourseInstances = useQuery(
    ["course-instances", pageState.pageData?.course_id],
    () =>
      fetchCourseInstances(
        (pageState.pageData as NonNullable<typeof pageState.pageData>)
          .course_id as NonNullable<string>,
      ),
    {
      enabled: pageState.pageData?.course_id !== null && open && pageState.state === "ready",
    },
  )

  useEffect(() => {
    const signedIn = !!loginState.signedIn
    const shouldChooseInstance =
      pageState.state === "ready" && pageState.instance === null && pageState.settings === null
    setOpen((signedIn && shouldChooseInstance) || (signedIn && manualOpen))
  }, [loginState, pageState, manualOpen])

  const handleSubmitAndClose = useCallback(
    async (instanceId: string, backgroundQuestionAnswers: NewCourseBackgroundQuestionAnswer[]) => {
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
    [onClose, pageState],
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
    <Dialog open={open} aria-labelledby={dialogTitleId} closeable={false}>
      <div
        className={css`
          margin: 1rem;
        `}
      >
        {!!submitError && <ErrorBanner variant={"readOnly"} error={submitError} />}
        <h1
          className={css`
            font-weight: 500;
            font-size: 22px;
            line-height: 26px;
            margin-bottom: 1rem;
          `}
          id={dialogTitleId}
        >
          {t("title-course-settings")}
        </h1>

        {getCourseInstances.isError && (
          <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
        )}
        {getCourseInstances.isLoading && <Spinner variant={"medium"} />}
        {getCourseInstances.isSuccess && (
          <SelectCourseInstanceForm
            courseInstances={getCourseInstances.data}
            onSubmitForm={handleSubmitAndClose}
            initialSelectedInstanceId={pageState.instance?.id}
          />
        )}
      </div>
    </Dialog>
  )
}

export default CourseInstanceSelectModal
