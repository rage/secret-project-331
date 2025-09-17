import { css } from "@emotion/css"
import { useQueries, useQuery } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ResearchOnCoursesForm from "../components/forms/ResearchOnCoursesForm"
import useAuthorizedClientsQuery from "../hooks/useAuthorizedClientsQuery"
import useUserResearchConsentQuery from "../hooks/useUserResearchConsentQuery"
import { getCourseBreadCrumbInfo } from "../services/backend/courses"
import { getAllResearchConsentAnswersByUserId } from "../services/backend/users"

import EditUserInformationForm from "@/components/forms/EditUserInformationForm"
import { getUserDetailsForUser } from "@/services/backend/user-details"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

interface Slug {
  name: string
  courseSlug: string
  courseId: string
  orgSlug: string
}

const UserSettings: React.FC<React.PropsWithChildren<Slug>> = () => {
  const { t } = useTranslation()

  const [openResearchForm, setOpenResearchForm] = useState<boolean>(false)
  const getUserConsent = useUserResearchConsentQuery()
  const { listQuery, revokeMutation } = useAuthorizedClientsQuery()

  const getUserDetails = useQuery({
    queryKey: [`user-details`],
    queryFn: () => getUserDetailsForUser(),
  })

  const getAllResearchFormAnswers = useQuery({
    queryKey: [`users-user-research-form-question-answers`],
    queryFn: () => getAllResearchConsentAnswersByUserId(),
  })
  const handleGeneralResearchFormButton = async () => {
    await getUserConsent.refetch()
    setOpenResearchForm(true)
  }

  const handleGeneralResearchFormAfterSubmit = () => {
    setOpenResearchForm(false)
  }

  const allCourseIds = useMemo(() => {
    const data = getAllResearchFormAnswers.data
      ?.map((obj) => obj.course_id)
      .filter((course_id: string, index, currentVal) => currentVal.indexOf(course_id) === index)
    return data ?? []
  }, [getAllResearchFormAnswers.data])

  const breadcrumbQueries =
    allCourseIds &&
    allCourseIds.map((courseId) => {
      return {
        // eslint-disable-next-line i18next/no-literal-string
        queryKey: [`course-${courseId}-breadcrumb-info`, courseId],
        queryFn: () => getCourseBreadCrumbInfo(courseId),
      }
    })
  const courseBreadcrumbInfos = useQueries({ queries: breadcrumbQueries })

  return (
    <>
      <h1>{t("user-settings")}</h1>
      <div
        className={css`
          padding: 1rem;
          border-top: 1px solid ${baseTheme.colors.gray[100]};
        `}
      >
        {getUserDetails.isError && (
          <ErrorBanner variant={"readOnly"} error={getUserDetails.error} />
        )}
        {getUserDetails.isLoading && <Spinner variant={"medium"} />}
        {!getUserDetails.isLoading && getUserDetails.isSuccess && getUserDetails.data !== null && (
          <EditUserInformationForm
            firstName={getUserDetails.data?.first_name ?? ""}
            lastName={getUserDetails.data?.last_name ?? ""}
            country={getUserDetails.data?.country ?? ""}
            emailCommunicationConsent={getUserDetails.data?.email_communication_consent ?? false}
            email={getUserDetails.data?.email}
          />
        )}
      </div>
      <h2
        className={css`
          padding-top: 1rem;
        `}
      >
        {t("title-research-consents")}
      </h2>

      <div
        className={css`
          border-top: 1px solid ${baseTheme.colors.gray[100]};
          display: flex;
          flex-direction: column;
        `}
      >
        <div
          className={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1rem 0rem 1rem;
          `}
        >
          <p
            className={css`
              font-size: ${baseTheme.fontSizes[2]}px;
            `}
          >
            {t("title-general-research-consent")}:
          </p>
          <Button size="medium" variant="primary" onClick={handleGeneralResearchFormButton}>
            {t("edit")}
          </Button>
        </div>

        {openResearchForm && (
          <ResearchOnCoursesForm
            afterSubmit={handleGeneralResearchFormAfterSubmit}
            initialConsentValue={getUserConsent.data?.research_consent}
          />
        )}

        {courseBreadcrumbInfos.length !== 0 && (
          <div>
            <h3
              className={css`
                padding: 1rem 1rem 0px 0px;
              `}
            >
              {t("title-course-specific-research-consents")}
            </h3>

            <div
              className={css`
                display: flex;
                flex-direction: column;
              `}
            >
              {courseBreadcrumbInfos.map((course) => (
                <div
                  key={course.data?.course_id}
                  className={css`
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1rem 0rem 1rem;
                  `}
                >
                  <p
                    className={css`
                      font-size: ${baseTheme.fontSizes[2]}px;
                    `}
                  >
                    {course.data?.course_name}:
                  </p>
                  <a
                    href={`org/${course.data?.organization_slug}/courses/${course.data?.course_slug}/?show_research_form=1`}
                  >
                    <Button size="medium" variant="primary">
                      {t("edit")}
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
        <h2
          className={css`
            padding-top: 1rem;
          `}
        >
          {t("authorized-applications")}
        </h2>

        <div
          className={css`
            border-top: 1px solid ${baseTheme.colors.gray[100]};
            display: flex;
            flex-direction: column;
            padding: 1rem;
          `}
        >
          {listQuery.isLoading && <Spinner variant="medium" />}
          {listQuery.isError && <ErrorBanner variant="readOnly" error={listQuery.error} />}
          {!listQuery.isLoading && listQuery.isSuccess && (
            <div>
              {listQuery.data.length === 0 && <p>{t("no-authorized-applications")}</p>}
              {listQuery.data.map((client) => (
                <div
                  key={client.client_id}
                  className={css`
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                  `}
                >
                  <div>
                    <strong>{client.client_name}</strong> <span>({client.scopes.join(", ")})</span>
                  </div>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => revokeMutation.mutate(client.client_id)}
                  >
                    {t("revoke")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default UserSettings
