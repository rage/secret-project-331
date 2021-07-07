import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import React, { useCallback, useContext, useEffect, useState } from "react"
import { useQuery } from "react-query"

import SelectCourseInstanceForm from "../forms/SelectCourseInstanceForm"
import { fetchCourseInstances, postCourseInstanceEnrollment } from "../../services/backend"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import CoursePageContext from "../../contexts/CoursePageContext"

export interface CourseInstanceSelectModalProps {
  onClose: () => void
}

const CourseInstanceSelectModal: React.FC<CourseInstanceSelectModalProps> = ({ onClose }) => {
  const loginState = useContext(LoginStateContext)
  const coursePageState = useContext(CoursePageContext)

  const [open, setOpen] = useState(false)
  const {
    data: courseInstances,
    error,
    isLoading,
  } = useQuery(
    ["course-instances", coursePageState.pageData?.course_id],
    () =>
      fetchCourseInstances(
        (coursePageState.pageData as NonNullable<typeof coursePageState.pageData>).course_id,
      ),
    {
      enabled: open && coursePageState.state === "ready",
    },
  )

  useEffect(() => {
    const signedIn = !!loginState.signedIn
    const shouldChooseInstance =
      coursePageState.state === "ready" && coursePageState.instance === null
    setOpen(signedIn && shouldChooseInstance)
  }, [loginState, coursePageState])

  const handleSubmitAndClose = useCallback(
    async (instanceId: string) => {
      try {
        await postCourseInstanceEnrollment(instanceId)
        setOpen(false)
        onClose()
      } catch (e) {
        // todo
      }
    },
    [onClose],
  )

  if (!open) {
    return null
  }

  if (error) {
    return <div>{JSON.stringify(error, undefined, 2)}</div>
  }

  if (isLoading || courseInstances === undefined) {
    return <div>Loading...</div>
  }

  return (
    <Dialog open={open} onClose={handleSubmitAndClose}>
      <div
        className={css`
          margin: 1rem;
        `}
      >
        <p>Select course version to continue.</p>
        <SelectCourseInstanceForm
          courseInstances={courseInstances}
          onSubmitForm={handleSubmitAndClose}
        />
      </div>
    </Dialog>
  )
}

export default CourseInstanceSelectModal
