import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Dialog } from "@mui/material"
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

import ExamComponent from "./ExamCard"

const ExamGrid = styled.div`
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding-bottom: 10px;
`

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

  const exams = getOrgExams.data.map((e) => (
    <ExamComponent
      key={e.id}
      id={e.id}
      name={e.name}
      // eslint-disable-next-line i18next/no-literal-string
      manageHref={`/manage/exams/${e.id}`}
      // eslint-disable-next-line i18next/no-literal-string
      navigateToExamHref={`/org/${organizationSlug}/exams/${e.id}`}
    />
  ))
  return (
    <div>
      <ExamGrid>{exams}</ExamGrid>

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
