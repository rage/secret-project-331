"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { isPast } from "date-fns" // Added import
import React, { useContext, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { CardList } from "./CardListStyles"
import ExamListItem from "./ExamListItem"

import NewExamDialog from "@/app/manage/exams/NewExamDialog"
import { fetchOrganizationExams } from "@/services/backend/exams"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

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
  const [showEnded, setShowEnded] = useState(false)

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

  const activeExams = useMemo(
    () =>
      getOrgExams.data?.filter((exam) => !exam.ends_at || !isPast(new Date(exam.ends_at))) ?? [],
    [getOrgExams.data],
  )
  const endedExams = useMemo(
    () => getOrgExams.data?.filter((exam) => exam.ends_at && isPast(new Date(exam.ends_at))) ?? [],
    [getOrgExams.data],
  )

  if (getOrgExams.isError) {
    return <ErrorBanner variant={"readOnly"} error={getOrgExams.error} />
  }

  if (getOrgExams.isLoading) {
    return <Spinner variant={"medium"} />
  }

  return (
    <div>
      <CardList>
        {activeExams.map((exam) => (
          <ExamListItem key={exam.id} exam={exam} organizationSlug={organizationSlug} />
        ))}
      </CardList>
      <Button variant="secondary" size="medium" onClick={() => setShowEnded(!showEnded)}>
        {showEnded ? t("hide-ended-exams") : t("show-ended-exams")}
      </Button>
      {showEnded && (
        <CardList>
          {endedExams.map((exam) => (
            <ExamListItem key={exam.id} exam={exam} organizationSlug={organizationSlug} />
          ))}
        </CardList>
      )}
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
