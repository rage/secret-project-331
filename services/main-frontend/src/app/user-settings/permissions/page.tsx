"use client"

import { css } from "@emotion/css"
import { useQueries, useQuery } from "@tanstack/react-query"
import { LinesClipboard, LinkChain, XmarkCircle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React, { useContext, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import DeleteUserAccountForm from "@/components/forms/DeleteUserAccountForm"
import ResearchOnCoursesForm from "@/components/forms/ResearchOnCoursesForm"
import {
  getCourseBreadcrumbInfoOptions,
  getUserDetailsForAuthenticatedUserOptions,
  getUserResearchFormQuestionAnswersOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import useAuthorizedClientsQuery from "@/hooks/useAuthorizedClientsQuery"
import useUserResearchConsentQuery from "@/hooks/useUserResearchConsentQuery"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { courseFrontPageRoute } from "@/shared-module/common/utils/routes"
import { QueryResult } from "@/shared-module/components"

const PermissionsSettingsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("link-permissions"))

  const loginStateContext = useContext(LoginStateContext)
  const [openResearchForm, setOpenResearchForm] = useState<boolean>(false)
  const getUserConsent = useUserResearchConsentQuery()
  const { listQuery, revokeMutation } = useAuthorizedClientsQuery()

  const getUserDetails = useQuery({
    ...getUserDetailsForAuthenticatedUserOptions(),
  })

  const getAllResearchFormAnswers = useQuery({
    ...getUserResearchFormQuestionAnswersOptions(),
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
        ...getCourseBreadcrumbInfoOptions({
          path: {
            course_id: courseId,
          },
        }),
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
            <h2
              className={css`
                font-size: 1.0625rem;
                font-weight: ${fontWeights.semibold};
                color: ${baseTheme.colors.gray[700]};
                margin: 0;
              `}
            >
              {t("title-research-consents")}
            </h2>
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
                color: ${baseTheme.colors.gray[500]};
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
              {loginStateContext.signedIn === true && (
                <QueryResult query={getUserConsent}>
                  {(data) =>
                    data?.research_consent === true
                      ? t("yes")
                      : data?.research_consent === false
                        ? t("no")
                        : "-"
                  }
                </QueryResult>
              )}
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
            <h3
              className={css`
                font-size: 0.8125rem;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                color: ${baseTheme.colors.gray[500]};
                margin: 0 0 0.75rem 0;
              `}
            >
              {t("title-course-specific-research-consents")}
            </h3>

            <div
              data-testid="course-specific-consents-list"
              className={css`
                display: flex;
                flex-direction: column;
                gap: 0.625rem;
              `}
            >
              {courseBreadcrumbInfos.map((course, index) => (
                <QueryResult key={`course-breadcrumb-${index}`} query={course}>
                  {(data) => (
                    <div
                      data-testid={`course-consent-item-${data.course_id}`}
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
                        data-testid={`course-consent-item-${data.course_id}-name`}
                        className={css`
                          font-size: 0.9375rem;
                          font-weight: 500;
                          color: ${baseTheme.colors.gray[700]};
                        `}
                      >
                        {data.course_name}
                      </span>
                      {data.organization_slug && data.course_slug && (
                        <Link
                          href={`${courseFrontPageRoute(data.organization_slug, data.course_slug)}/?show_research_form=1`}
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
                  )}
                </QueryResult>
              ))}
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
          <h2
            className={css`
              font-size: 1.0625rem;
              font-weight: ${fontWeights.semibold};
              color: ${baseTheme.colors.gray[700]};
              margin: 0;
            `}
          >
            {t("user-settings-authorized-apps")}
          </h2>
        </div>

        {loginStateContext.signedIn === true && (
          <QueryResult
            query={listQuery}
            emptyFallback={
              <div
                data-testid="authorized-applications-list"
                className={css`
                  display: flex;
                  flex-direction: column;
                  gap: 0.625rem;
                `}
              >
                <p
                  className={css`
                    color: ${baseTheme.colors.gray[500]};
                    font-size: 0.875rem;
                    margin: 0;
                  `}
                >
                  {t("no-authorized-applications")}
                </p>
              </div>
            }
          >
            {(data) => (
              <div
                data-testid="authorized-applications-list"
                className={css`
                  display: flex;
                  flex-direction: column;
                  gap: 0.625rem;
                `}
              >
                {data.map((client) => (
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
          </QueryResult>
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
            <h2
              className={css`
                font-size: 1.0625rem;
                font-weight: ${fontWeights.semibold};
                color: ${baseTheme.colors.gray[700]};
                margin: 0;
              `}
            >
              {t("user-settings-delete-account")}
            </h2>
          </div>
          <DeleteUserAccountForm email={getUserDetails.data.email} />
        </div>
      )}
    </div>
  )
}

export default PermissionsSettingsPage
