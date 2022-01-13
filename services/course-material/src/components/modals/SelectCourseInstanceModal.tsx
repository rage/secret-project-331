import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import React, { useCallback, useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import CoursePageContext from "../../contexts/CoursePageContext"
import { fetchCourseInstances, postCourseInstanceEnrollment } from "../../services/backend"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import SelectCourseInstanceForm from "../forms/SelectCourseInstanceForm"

export interface CourseInstanceSelectModalProps {
  onClose: () => void
}

const CourseInstanceSelectModal: React.FC<CourseInstanceSelectModalProps> = ({ onClose }) => {
  const { t } = useTranslation()
  const loginState = useContext(LoginStateContext)
  const coursePageState = useContext(CoursePageContext)

  const [submitError, setSubmitError] = useState<unknown>()
  const [open, setOpen] = useState(false)
  const getCourseInstances = useQuery(
    ["course-instances", coursePageState.pageData?.course_id],
    () =>
      fetchCourseInstances(
        (coursePageState.pageData as NonNullable<typeof coursePageState.pageData>)
          .course_id as NonNullable<string>,
      ),
    {
      enabled:
        coursePageState.pageData?.course_id !== null && open && coursePageState.state === "ready",
    },
  )

  useEffect(() => {
    const signedIn = !!loginState.signedIn
    const shouldChooseInstance =
      coursePageState.state === "ready" &&
      coursePageState.instance === null &&
      coursePageState.settings === null
    setOpen(signedIn && shouldChooseInstance)
  }, [loginState, coursePageState])

  const handleSubmitAndClose = useCallback(
    async (instanceId: string) => {
      try {
        await postCourseInstanceEnrollment(instanceId)
        setOpen(false)
        onClose()
      } catch (e) {
        setSubmitError(e)
      }
    },
    [onClose],
  )

  if (coursePageState.pageData?.course_id === null) {
    // No course id
    // eslint-disable-next-line i18next/no-literal-string
    return <ErrorBanner variant={"readOnly"} error={"No course ID defined"} />
  }

  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onClose={handleSubmitAndClose}>
      <div
        className={css`
          margin: 1rem;
        `}
      >
        {submitError && <ErrorBanner variant={"readOnly"} error={submitError} />}
        <h4>{t("title-select-course-version-to-continue")}.</h4>
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
          />
        )}
      </div>
    </Dialog>
  )
}

export default CourseInstanceSelectModal
