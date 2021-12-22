import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "react-query"

import Layout from "../../../components/Layout"
import { fetchExam, setCourse, unsetCourse } from "../../../services/backend/exams"
import { ErrorResponse } from "../../../shared-module/bindings"
import { isErrorResponse } from "../../../shared-module/bindings.guard"
import Button from "../../../shared-module/components/Button"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import TextField from "../../../shared-module/components/InputFields/TextField"
import Spinner from "../../../shared-module/components/Spinner"
import { wideWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

interface OrganizationPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Organization: React.FC<OrganizationPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const getExam = useQuery(`exam-${query.id}`, () => fetchExam(query.id))
  const [newCourse, setNewCourse] = useState("")
  const [errorResponse, setErrorResponse] = useState<ErrorResponse | null>(null)
  const setCourseMutation = useMutation(
    ({ examId, courseId }: { examId: string; courseId: string }) => {
      setErrorResponse(null)
      return setCourse(examId, courseId)
    },
    {
      onSuccess: (data) => {
        if (isErrorResponse(data)) {
          setErrorResponse(data)
        } else {
          getExam.refetch()
        }
      },
    },
  )
  const unsetCourseMutation = useMutation(
    ({ examId, courseId }: { examId: string; courseId: string }) => {
      setErrorResponse(null)
      return unsetCourse(examId, courseId)
    },
    {
      onSuccess: (data) => {
        if (isErrorResponse(data)) {
          setErrorResponse(data)
        } else {
          getExam.refetch()
        }
      },
    },
  )

  return (
    <Layout frontPageUrl={"/"} navVariant={"complex"}>
      <div
        className={css`
          ${wideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        {getExam.isError && <ErrorBanner variant={"readOnly"} error={getExam.error} />}
        {getExam.isLoading && <Spinner variant={"medium"} />}
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
            {errorResponse && <div>{JSON.stringify(errorResponse, undefined, 2)}</div>}
          </>
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))
