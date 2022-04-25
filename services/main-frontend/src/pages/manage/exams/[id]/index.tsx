import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import { fetchExam, setCourse, unsetCourse } from "../../../../services/backend/exams"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface OrganizationPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Organization: React.FC<OrganizationPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const getExam = useQuery(`exam-${query.id}`, () => fetchExam(query.id))
  const [newCourse, setNewCourse] = useState("")
  const setCourseMutation = useToastMutation(
    ({ examId, courseId }: { examId: string; courseId: string }) => {
      return setCourse(examId, courseId)
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        getExam.refetch()
      },
    },
  )
  const unsetCourseMutation = useToastMutation(
    ({ examId, courseId }: { examId: string; courseId: string }) => {
      return unsetCourse(examId, courseId)
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        getExam.refetch()
      },
    },
  )

  return (
    <Layout navVariant={"simple"}>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {getExam.isError && <ErrorBanner variant={"readOnly"} error={getExam.error} />}
        {(getExam.isLoading || getExam.isIdle) && <Spinner variant={"medium"} />}
        {getExam.isSuccess && (
          <>
            <h1>
              {getExam.data.name} {getExam.data.id}
            </h1>
            <ul
              className={css`
                list-style-type: none;
                padding-left: 0;
              `}
            >
              <li>
                <a href={`/cms/pages/${getExam.data.page_id}`}>{t("manage-page")}</a> (
                {getExam.data.page_id})
              </li>
              <li>
                <a
                  href={`/manage/exams/${getExam.data.id}/permissions`}
                  aria-label={`${t("link-manage-permissions")} ${getExam.data.name}`}
                >
                  {t("link-manage-permissions")}
                </a>
              </li>
              <li>
                <a href={`/cms/exams/${getExam.data.id}/edit`}>
                  {t("link-edit-exam-instructions")}
                </a>
              </li>
              <li>
                <a href={`/api/v0/main-frontend/exams/${getExam.data.id}/export-points`}>
                  {t("link-export-points")}
                </a>
              </li>
              <li>
                <a href={`/api/v0/main-frontend/exams/${getExam.data.id}/export-submissions`}>
                  {t("link-export-submissions")}
                </a>
              </li>
            </ul>
            <h2>{t("courses")}</h2>
            {getExam.data.courses.map((c) => (
              <div key={c.id}>
                <a href={`/manage/courses/${c.id}`}>{c.name}</a> ({c.id}){" "}
                <Button
                  onClick={() => {
                    unsetCourseMutation.mutate({ examId: getExam.data.id, courseId: c.id })
                  }}
                  variant={"secondary"}
                  size={"medium"}
                >
                  {t("button-text-remove")}
                </Button>
              </div>
            ))}
            <TextField
              label={t("add-course")}
              onChange={function (value: string): void {
                setNewCourse(value)
              }}
              placeholder={t("course-id")}
              className={css`
                margin-bottom: 1rem;
              `}
            ></TextField>

            <Button
              onClick={() => {
                setCourseMutation.mutate({ examId: getExam.data.id, courseId: newCourse })
                setNewCourse("")
              }}
              variant={"secondary"}
              size={"medium"}
            >
              {t("add-course")}
            </Button>
            {setCourseMutation.isError && (
              <ErrorBanner variant={"readOnly"} error={setCourseMutation.error} />
            )}
            {unsetCourseMutation.isError && (
              <ErrorBanner variant={"readOnly"} error={unsetCourseMutation.error} />
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Organization)))
