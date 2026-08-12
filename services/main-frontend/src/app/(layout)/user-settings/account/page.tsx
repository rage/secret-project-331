"use client"

import { css } from "@emotion/css"
import { Padlock } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import EmailVerificationSection from "@/components/EmailVerificationSection"
import ChangeUserPasswordForm from "@/components/forms/ChangeUserPasswordForm"
import EditUserInformationForm from "@/components/forms/EditUserInformationForm"
import { useUserDetailsForUserQuery } from "@/hooks/useUserDetailsForUserQuery"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { profileStudiesRoute } from "@/shared-module/common/utils/routes"
import { Link, QueryResult } from "@/shared-module/components"
import { settingsCardCss } from "@/styles/sharedStyles"

const AccountSettingsPage: React.FC = () => {
  const { t } = useTranslation()
  // Higher order than the parent user-settings layout so this specific page title wins deterministically.
  usePageTitle(t("title-account-settings"), { order: 10 })

  const getUserDetails = useUserDetailsForUserQuery()

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
      <QueryResult query={getUserDetails}>
        {(data) => (
          <>
            <EditUserInformationForm
              firstName={data.first_name ?? ""}
              lastName={data.last_name ?? ""}
              country={data.country ?? ""}
              emailCommunicationConsent={data.email_communication_consent ?? false}
              email={data.email}
            />

            <EmailVerificationSection />

            <div className={settingsCardCss}>
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
                  <Padlock
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
                  {t("user-settings-password-security")}
                </h3>
              </div>
              <ChangeUserPasswordForm />
            </div>
          </>
        )}
      </QueryResult>

      {/* Pointer only: the study record lives on the profile, not on this preferences page. */}
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.5rem;
          color: ${baseTheme.colors.gray[600]};
          font-size: 0.9375rem;
        `}
      >
        <span>{t("your-course-progress-and-completions-are-in-your-profile")}</span>
        <Link href={profileStudiesRoute()}>{t("heading-your-studies")}</Link>
      </div>
    </div>
  )
}

export default AccountSettingsPage
