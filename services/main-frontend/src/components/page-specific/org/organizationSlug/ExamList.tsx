import { css } from "@emotion/css"
import { Dialog, DialogContentText, DialogTitle } from "@mui/material"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import {
  createExam,
  createExamDuplicate,
  fetchOrganizationExams,
} from "../../../../services/backend/exams"
import { NewExam } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
import NewExamForm from "../../../forms/NewExamForm"

interface Props {
  organizationId: string
  organizationSlug: string
}

const ExamList: React.FC<Props> = ({ organizationId, organizationSlug }) => {
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

  const createExamMutation = useToastMutation(
    (exam: NewExam) => createExam(organizationId, exam),
    {
      notify: true,
      successMessage: t("exam-created-succesfully"),
      method: "POST",
    },
    { onSuccess: () => getOrgExams.refetch() },
  )

  const duplicateExamMutation = useToastMutation(
    (data: { examId: string; newExam: NewExam }) => createExamDuplicate(data.examId, data.newExam),
    {
      notify: true,
      successMessage: t("exam-duplicated-succesfully"),
      method: "POST",
    },
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

  return (
    <div>
      <ul>
        {getOrgExams.data.map((exam) => {
          return (
            <li key={exam.id}>
              <a href={`/org/${organizationSlug}/exams/${exam.id}`}>{exam.name}</a>
              <br />
              <a href={`/manage/exams/${exam.id}`}>{t("manage")}</a>
            </li>
          )
        })}
      </ul>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <Dialog
          open={newExamFormOpen}
          onClose={() => setNewExamFormOpen(!newExamFormOpen)}
          className={css`
            padding: 1rem;
          `}
          // eslint-disable-next-line i18next/no-literal-string
          aria-label="New Exam dialog"
          role="dialog"
        >
          <DialogTitle id="alert-dialog-title">
            <h1>{t("new-exam")}</h1>
          </DialogTitle>
          <DialogContentText role="main" id="alert-dialog-description">
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
                exams={getOrgExams.data}
                initialData={null}
                organization={organizationId}
                onCancel={() => setNewExamFormOpen(!newExamFormOpen)}
                onCreateNewExam={(newExam) => createExamMutation.mutate(newExam)}
                onDuplicateExam={(parentId: string, newExam: NewExam) =>
                  duplicateExamMutation.mutate({ examId: parentId, newExam: newExam })
                }
              />
            </div>
          </DialogContentText>
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
        </>
      )}
    </div>
  )
}
export default ExamList
