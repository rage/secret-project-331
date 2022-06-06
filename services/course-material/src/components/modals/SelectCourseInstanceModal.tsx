import { css } from "@emotion/css"
import { Dialog } from "@mui/material"
import React, { useCallback, useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import PageContext from "../../contexts/PageContext"
import { fetchCourseInstances, postCourseInstanceEnrollment } from "../../services/backend"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import SelectCourseInstanceForm from "../forms/SelectCourseInstanceForm"

export interface CourseInstanceSelectModalProps {
  onClose: () => void
  manualOpen?: boolean
}

const CourseInstanceSelectModal: React.FC<CourseInstanceSelectModalProps> = ({
  onClose,
  manualOpen = false,
}) => {
  const { t } = useTranslation()
  const loginState = useContext(LoginStateContext)
  const pageState = useContext(PageContext)

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
    async (instanceId: string, reason?: string) => {
      if (reason === "backdropClick") {
        return
      }
      try {
        await postCourseInstanceEnrollment(instanceId)
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
    [onClose],
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
    <Dialog open={open} onClose={handleSubmitAndClose} aria-labelledby="dialog-label">
      <div
        className={css`
          margin: 1rem;
        `}
      >
        {submitError && <ErrorBanner variant={"readOnly"} error={submitError} />}
        <h1
          className={css`
            font-size: clamp(18px, 2vw, 20px);
          `}
          id="dialog-label"
        >
          {t("title-select-course-instance-to-continue")}
        </h1>
        <div
          className={css`
            margin-bottom: 0.6rem;
          `}
        >
          {t("select-course-instance-explanation")}
        </div>
        {getCourseInstances.isError && (
          <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
        )}
        {(getCourseInstances.isLoading || getCourseInstances.isIdle) && (
          <Spinner variant={"medium"} />
        )}
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
