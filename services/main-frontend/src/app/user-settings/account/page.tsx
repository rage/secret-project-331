"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { Padlock } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import ChangeUserPasswordForm from "@/components/forms/ChangeUserPasswordForm"
import EditUserInformationForm from "@/components/forms/EditUserInformationForm"
import { getUserDetailsForUser } from "@/services/backend/user-details"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const AccountSettingsPage: React.FC = () => {
  const { t } = useTranslation()

  const getUserDetails = useQuery({
    queryKey: [`user-details`],
    queryFn: () => getUserDetailsForUser(),
  })

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
      {getUserDetails.isError && <ErrorBanner variant={"readOnly"} error={getUserDetails.error} />}
      {getUserDetails.isLoading && <Spinner variant={"medium"} />}
      {getUserDetails.isSuccess && getUserDetails.data !== null && (
        <>
          <EditUserInformationForm
            firstName={getUserDetails.data?.first_name ?? ""}
            lastName={getUserDetails.data?.last_name ?? ""}
            country={getUserDetails.data?.country ?? ""}
            emailCommunicationConsent={getUserDetails.data?.email_communication_consent ?? false}
            email={getUserDetails.data?.email}
          />

          <div
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
    </div>
  )
}

export default AccountSettingsPage
