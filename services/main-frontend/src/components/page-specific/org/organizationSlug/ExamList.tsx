import { css } from "@emotion/css"
import { Dialog } from "@mui/material"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { createExam, fetchOrganizationExams } from "../../../../services/backend/exams"
import { NewExam } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
import NewExamForm from "../../../forms/NewExamForm"

import { CourseGrid } from "./CourseCard"
import ExamComponent from "./ExamCard"

interface Props {
  organizationId: string
}

const ExamList: React.FC<Props> = ({ organizationId }) => {
  const { t } = useTranslation()

  const getOrgExams = useQuery(
    "organization-exams",
    () => {
      if (organizationId) {
        return fetchOrganizationExams(organizationId)
      } else {
        return Promise.reject(new Error("Organization ID undefined"))
      }
    },
    { enabled: !!organizationId },
  )

  const examMutation = useToastMutation(
    (exam: NewExam) => createExam(organizationId, exam),
    { notify: true, successMessage: t("exam-created-succesfully"), method: "POST" },
    { onSuccess: () => getOrgExams.refetch() },
  )

  const loginStateContext = useContext(LoginStateContext)

  const [newExamFormOpen, setNewExamFormOpen] = useState(false)

  if (getOrgExams.isError) {
    return <ErrorBanner variant={"readOnly"} error={getOrgExams.error} />
  }

  if (getOrgExams.isIdle || getOrgExams.isLoading) {
    return <Spinner variant={"medium"} />
  }

  const exams = getOrgExams.data.map((e) => <ExamComponent key={e.id} id={e.id} />)
  return (
    <div>
      <CourseGrid>{exams}</CourseGrid>

      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <Dialog open={newExamFormOpen} onClose={() => setNewExamFormOpen(!newExamFormOpen)}>
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button
              size="medium"
              variant="secondary"
              onClick={() => setNewExamFormOpen(!newExamFormOpen)}
            >
              {t("button-text-close")}
            </Button>
            <NewExamForm
              initialData={null}
              organization={organizationId}
              onCancel={() => setNewExamFormOpen(!newExamFormOpen)}
              onSubmit={(data) => examMutation.mutate(data)}
            />
          </div>
        </Dialog>
      </div>
      <br />
      {loginStateContext.signedIn && (
        <>
          <Button
            size="medium"
            variant="primary"
            onClick={() => setNewExamFormOpen(!newExamFormOpen)}
          >
            {t("button-text-create")}
          </Button>
          <br />
          <br />
        </>
      )}
    </div>
  )
}
export default ExamList
