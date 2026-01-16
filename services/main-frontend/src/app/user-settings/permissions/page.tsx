"use client"

import { css } from "@emotion/css"
import { useQueries, useQuery } from "@tanstack/react-query"
import { LinesClipboard, LinkChain, XmarkCircle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import DeleteUserAccountForm from "@/components/forms/DeleteUserAccountForm"
import ResearchOnCoursesForm from "@/components/forms/ResearchOnCoursesForm"
import useAuthorizedClientsQuery from "@/hooks/useAuthorizedClientsQuery"
import useUserResearchConsentQuery from "@/hooks/useUserResearchConsentQuery"
import { getCourseBreadCrumbInfo } from "@/services/backend/courses"
import { getUserDetailsForUser } from "@/services/backend/user-details"
import { getAllResearchConsentAnswersByUserId } from "@/services/backend/users"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { courseFrontPageRoute } from "@/shared-module/common/utils/routes"

const PermissionsSettingsPage: React.FC = () => {
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

  const breadcrumbQueries = useMemo(
    () =>
      allCourseIds.map((courseId) => ({
        // eslint-disable-next-line i18next/no-literal-string
        queryKey: [`course-${courseId}-breadcrumb-info`, courseId],
        queryFn: () => getCourseBreadCrumbInfo(courseId),
      })),
    [allCourseIds],
  )
  const courseBreadcrumbInfos = useQueries({ queries: breadcrumbQueries })

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        ${respondToOrLarger.md} {
          gap: 1.5rem;
        }
      `}
    >
      <div
        data-testid="research-consents-section"
        className={css`
          background: #fff;
          border: 1px solid ${baseTheme.colors.gray[100]};
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.04),
            0 1px 2px rgba(0, 0, 0, 0.02);
          ${respondToOrLarger.md} {
            padding: 1.75rem;
          }
        `}
      >
        <div
          className={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.25rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid ${baseTheme.colors.gray[100]};
          `}
        >
          <div
            className={css`
              display: flex;
              align-items: center;
              gap: 0.625rem;
            `}
          >
            <div
              className={css`
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background: ${baseTheme.colors.green[75]};
                border-radius: 6px;
                flex-shrink: 0;
              `}
            >
              <LinesClipboard
                size={16}
                className={css`
                  color: ${baseTheme.colors.green[700]};
                `}
              />
            </div>
            <h3
              className={css`
                font-size: 1.0625rem;
                font-weight: ${fontWeights.semibold};
                color: ${baseTheme.colors.gray[700]};
                margin: 0;
              `}
            >
              {t("title-research-consents")}
            </h3>
          </div>
          <button
            data-testid="edit-research-consent-button"
            onClick={handleGeneralResearchFormButton}
            className={css`
              display: inline-flex;
              align-items: center;
              font-size: 0.8125rem;
              font-weight: 500;
              color: ${baseTheme.colors.green[700]};
              background: transparent;
              border: none;
              padding: 0.375rem 0.625rem;
              border-radius: 6px;
              cursor: pointer;
              transition: all 0.15s ease;
              &:hover {
                background: ${baseTheme.colors.green[75]};
              }
            `}
          >
            {t("edit")}
          </button>
        </div>

        {!openResearchForm && (
          <div
            className={css`
              margin-top: 1rem;
            `}
          >
            <div
              className={css`
                font-size: 0.75rem;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                color: ${baseTheme.colors.gray[400]};
                margin-bottom: 0.375rem;
              `}
            >
              {t("title-general-research-consent")}
            </div>
            <div
              data-testid="general-research-consent-value"
              className={css`
                font-size: 0.9375rem;
                color: ${baseTheme.colors.gray[700]};
                font-weight: 500;
              `}
            >
              {getUserConsent.isLoading && <Spinner variant="small" />}
              {getUserConsent.isError && (
                <ErrorBanner variant="readOnly" error={getUserConsent.error} />
              )}
              {getUserConsent.isSuccess &&
                (getUserConsent.data?.research_consent === true
                  ? t("yes")
                  : getUserConsent.data?.research_consent === false
                    ? t("no")
                    : "-")}
            </div>
          </div>
        )}

        {openResearchForm && (
          <ResearchOnCoursesForm
            afterSubmit={handleGeneralResearchFormAfterSubmit}
            initialConsentValue={getUserConsent.data?.research_consent}
          />
        )}

        {courseBreadcrumbInfos.length > 0 && (
          <div
            className={css`
              margin-top: 1rem;
            `}
          >
            <h4
              className={css`
                font-size: 0.8125rem;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                color: ${baseTheme.colors.gray[400]};
                margin: 0 0 0.75rem 0;
              `}
            >
              {t("title-course-specific-research-consents")}
            </h4>

            <div
              data-testid="course-specific-consents-list"
              className={css`
                display: flex;
                flex-direction: column;
                gap: 0.625rem;
              `}
            >
              {courseBreadcrumbInfos.map((course, index) => {
                if (course.isLoading) {
                  return (
                    <div key={`loading-${index}`}>
                      <Spinner variant="small" />
                    </div>
                  )
                }
                if (course.isError) {
                  return (
                    <div key={`error-${index}`}>
                      <ErrorBanner variant="readOnly" error={course.error} />
                    </div>
                  )
                }
                if (!course.data) {
                  return null
                }

                return (
                  <div
                    key={course.data.course_id}
                    data-testid={`course-consent-${course.data.course_id}`}
                    className={css`
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      padding: 0.875rem 1rem;
                      background: ${baseTheme.colors.gray[50]};
                      border: 1px solid ${baseTheme.colors.gray[100]};
                      border-radius: 8px;
                    `}
                  >
                    <span
                      data-testid={`course-consent-name-${course.data.course_id}`}
                      className={css`
                        font-size: 0.9375rem;
                        font-weight: 500;
                        color: ${baseTheme.colors.gray[700]};
                      `}
                    >
                      {course.data.course_name}
                    </span>
                    {course.data.organization_slug && course.data.course_slug && (
                      <Link
                        href={`${courseFrontPageRoute(course.data.organization_slug, course.data.course_slug)}/?show_research_form=1`}
                        className={css`
                          font-size: 0.8125rem;
                          font-weight: 500;
                          color: ${baseTheme.colors.green[700]};
                          text-decoration: none;
                          padding: 0.375rem 0.625rem;
                          border-radius: 6px;
                          transition: all 0.15s ease;
                          &:hover {
                            background: ${baseTheme.colors.green[75]};
                          }
                        `}
                      >
                        {t("edit")}
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div
        data-testid="authorized-applications-section"
        className={css`
          background: #fff;
          border: 1px solid ${baseTheme.colors.gray[100]};
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.04),
            0 1px 2px rgba(0, 0, 0, 0.02);
          ${respondToOrLarger.md} {
            padding: 1.75rem;
          }
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 0.625rem;
            margin-bottom: 1.25rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid ${baseTheme.colors.gray[100]};
          `}
        >
          <div
            className={css`
              display: flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              background: ${baseTheme.colors.green[75]};
              border-radius: 6px;
              flex-shrink: 0;
            `}
          >
            <LinkChain
              size={16}
              className={css`
                color: ${baseTheme.colors.green[700]};
              `}
            />
          </div>
          <h3
            className={css`
              font-size: 1.0625rem;
              font-weight: ${fontWeights.semibold};
              color: ${baseTheme.colors.gray[700]};
              margin: 0;
            `}
          >
            {t("user-settings-authorized-apps")}
          </h3>
        </div>

        {listQuery.isLoading && <Spinner variant="medium" />}
        {listQuery.isError && <ErrorBanner variant="readOnly" error={listQuery.error} />}
        {!listQuery.isLoading && listQuery.isSuccess && (
          <div
            data-testid="authorized-applications-list"
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.625rem;
            `}
          >
            {listQuery.data.length === 0 && (
              <p
                className={css`
                  color: ${baseTheme.colors.gray[400]};
                  font-size: 0.875rem;
                  margin: 0;
                `}
              >
                {t("no-authorized-applications")}
              </p>
            )}
            {listQuery.data.map((client) => (
              <div
                key={client.client_id}
                data-testid={`authorized-app-${client.client_id}`}
                className={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 0.875rem 1rem;
                  background: ${baseTheme.colors.gray[50]};
                  border: 1px solid ${baseTheme.colors.gray[100]};
                  border-radius: 8px;
                `}
              >
                <div>
                  <div
                    data-testid={`app-name-${client.client_id}`}
                    className={css`
                      font-weight: 500;
                      color: ${baseTheme.colors.gray[700]};
                      font-size: 0.9375rem;
                      margin-bottom: 0.125rem;
                    `}
                  >
                    {client.client_name}
                  </div>
                  <div
                    data-testid={`app-scopes-${client.client_id}`}
                    className={css`
                      font-size: 0.8125rem;
                      color: ${baseTheme.colors.gray[400]};
                    `}
                  >
                    {client.scopes.join(", ")}
                  </div>
                </div>
                <button
                  data-testid={`revoke-app-${client.client_id}`}
                  onClick={() => revokeMutation.mutate(client.client_id)}
                  disabled={revokeMutation.isPending}
                  className={css`
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: ${baseTheme.colors.red[600]};
                    background: transparent;
                    border: none;
                    padding: 0.375rem 0.625rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    &:hover {
                      background: ${baseTheme.colors.red[75]};
                    }
                    &:disabled {
                      opacity: 0.5;
                      cursor: not-allowed;
                    }
                  `}
                >
                  {t("revoke")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {getUserDetails.isSuccess && getUserDetails.data?.email && (
        <div
          data-testid="delete-account-section"
          className={css`
            background: #fff;
            border: 1px solid ${baseTheme.colors.red[100]};
            border-radius: 12px;
            padding: 1.25rem;
            box-shadow:
              0 1px 3px rgba(0, 0, 0, 0.04),
              0 1px 2px rgba(0, 0, 0, 0.02);
            ${respondToOrLarger.md} {
              padding: 1.75rem;
            }
          `}
        >
          <div
            className={css`
              display: flex;
              align-items: center;
              gap: 0.625rem;
              margin-bottom: 1.25rem;
              padding-bottom: 1rem;
              border-bottom: 1px solid ${baseTheme.colors.red[100]};
            `}
          >
            <div
              className={css`
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background: ${baseTheme.colors.red[75]};
                border-radius: 6px;
                flex-shrink: 0;
              `}
            >
              <XmarkCircle
                size={16}
                className={css`
                  color: ${baseTheme.colors.red[700]};
                `}
              />
            </div>
            <h3
              className={css`
                font-size: 1.0625rem;
                font-weight: ${fontWeights.semibold};
                color: ${baseTheme.colors.gray[700]};
                margin: 0;
              `}
            >
              {t("user-settings-delete-account")}
            </h3>
          </div>
          <DeleteUserAccountForm email={getUserDetails.data.email} />
        </div>
      )}
    </div>
  )
}

export default PermissionsSettingsPage
