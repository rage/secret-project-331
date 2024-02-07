import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import { fetchOrganizationExams } from "../../../../services/backend/exams"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import OnlyRenderIfPermissions from "../../../../shared-module/components/OnlyRenderIfPermissions"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import NewExamDialog from "../../manage/courses/id/exams/NewExamDialog"

interface Props {
  organizationId: string
  organizationSlug: string
}

const ExamList: React.FC<React.PropsWithChildren<Props>> = ({
  organizationId,
  organizationSlug,
}) => {
  const { t } = useTranslation()

  const [newExamFormOpen, setNewExamFormOpen] = useState(false)

  const getOrgExams = useQuery({
    queryKey: ["organization-exams", organizationId],
    queryFn: () => {
      if (organizationId) {
        return fetchOrganizationExams(organizationId)
      } else {
        return Promise.reject(new Error("Organization ID undefined"))
      }
    },
    enabled: !!organizationId,
  })

  const loginStateContext = useContext(LoginStateContext)

  if (getOrgExams.isError) {
    return <ErrorBanner variant={"readOnly"} error={getOrgExams.error} />
  }

  if (getOrgExams.isPending) {
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
              <a
                href={`/manage/exams/${exam.id}?org-slug=${organizationSlug}&org-id=${organizationId}`}
              >
                {t("manage")}
              </a>
            </li>
          )
        })}
      </ul>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <NewExamDialog
          organizationId={organizationId}
          getOrgExams={getOrgExams}
          open={newExamFormOpen}
          close={() => setNewExamFormOpen(!setNewExamFormOpen)}
        />
      </div>
      <br />
      {loginStateContext.signedIn && (
        <OnlyRenderIfPermissions
          action={{ type: "create_courses_or_exams" }}
          resource={{ id: organizationId, type: "organization" }}
        >
          <Button
            size="medium"
            variant="primary"
            onClick={() => setNewExamFormOpen(!newExamFormOpen)}
          >
            {t("button-text-create")}
          </Button>
        </OnlyRenderIfPermissions>
      )}
    </div>
  )
}
export default ExamList
