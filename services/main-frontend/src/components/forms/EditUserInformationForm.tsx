"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { Pencil } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { refetchUserDetailsForUser } from "@/hooks/useUserDetailsForUserQuery"
import { updateUserInfo } from "@/services/backend/user-details"
import { UserDetail } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import SearchableSelectField from "@/shared-module/common/components/InputFields/SearchableSelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import countries from "@/shared-module/common/locales/en/countries.json"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

type SelectUserInfoFormFields = {
  email: string
  first_name: string
  last_name: string
  country: string
  emailCommunicationConsent: boolean
}

type SelectUserInfoFormProps = {
  email: string
  firstName: string
  lastName: string
  country: string
  emailCommunicationConsent: boolean
}

export const EditUserInformationForm: React.FC<SelectUserInfoFormProps> = ({
  firstName,
  lastName,
  country,
  emailCommunicationConsent,
  email,
}) => {
  const { t } = useTranslation()
  const { t: tCountries } = useTranslation("countries")
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  const {
    handleSubmit,
    formState: { errors },
    control,
    register,
    reset,
  } = useForm<SelectUserInfoFormFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      email,
      first_name: firstName,
      last_name: lastName,
      country: country,
      emailCommunicationConsent: emailCommunicationConsent,
    },
  })

  const countriesOptions = React.useMemo(
    () =>
      Object.entries(countries).map(([code]) => ({
        value: code,
        label: tCountries(code as keyof typeof countries),
      })),
    [tCountries],
  )

  const postUserCountryMutation = useToastMutation<UserDetail, unknown, SelectUserInfoFormFields>(
    async (data) => {
      const { email, first_name, last_name, country, emailCommunicationConsent } = data
      const result = await updateUserInfo(
        email,
        first_name,
        last_name,
        country,
        emailCommunicationConsent,
      )
      return result
    },
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: async () => {
        setIsEditing(false)
        await refetchUserDetailsForUser(queryClient)
      },
    },
  )

  const handleCancel = () => {
    reset({
      email,
      first_name: firstName,
      last_name: lastName,
      country: country,
      emailCommunicationConsent: emailCommunicationConsent,
    })
    setIsEditing(false)
  }

  const selectedCountryLabel = React.useMemo(() => {
    if (!country) {
      return ""
    }
    return tCountries(country as keyof typeof countries)
  }, [country, tCountries])

  if (!isEditing) {
    return (
      <div
        data-testid="personal-information-section"
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
          <h3
            className={css`
              font-size: 1.0625rem;
              font-weight: 600;
              color: ${baseTheme.colors.gray[700]};
              margin: 0;
            `}
          >
            {t("user-settings-personal-info")}
          </h3>
          <button
            data-testid="edit-profile-button"
            onClick={() => setIsEditing(true)}
            className={css`
              display: inline-flex;
              align-items: center;
              gap: 0.375rem;
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
            <Pencil size={14} />
            {t("user-settings-edit-profile")}
          </button>
        </div>

        <div
          className={css`
            display: grid;
            gap: 1.25rem;
            ${respondToOrLarger.md} {
              grid-template-columns: repeat(2, 1fr);
              gap: 1.25rem 2rem;
            }
          `}
        >
          <div
            className={css`
              ${respondToOrLarger.md} {
                grid-column: span 2;
              }
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
              {t("email")}
            </div>
            <div
              data-testid="personal-info-email-value"
              className={css`
                font-size: 0.9375rem;
                color: ${baseTheme.colors.gray[700]};
                font-weight: 500;
              `}
            >
              {email || "-"}
            </div>
          </div>

          <div>
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
              {t("first-name")}
            </div>
            <div
              data-testid="personal-info-first-name-value"
              className={css`
                font-size: 0.9375rem;
                color: ${baseTheme.colors.gray[700]};
                font-weight: 500;
              `}
            >
              {firstName || "-"}
            </div>
          </div>

          <div>
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
              {t("last-name")}
            </div>
            <div
              data-testid="personal-info-last-name-value"
              className={css`
                font-size: 0.9375rem;
                color: ${baseTheme.colors.gray[700]};
                font-weight: 500;
              `}
            >
              {lastName || "-"}
            </div>
          </div>

          <div>
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
              {t("enter-country-question")}
            </div>
            <div
              data-testid="personal-info-country-value"
              className={css`
                font-size: 0.9375rem;
                color: ${baseTheme.colors.gray[700]};
                font-weight: 500;
              `}
            >
              {selectedCountryLabel || "-"}
            </div>
          </div>
        </div>

        <div
          className={css`
            margin-top: 1.25rem;
            padding-top: 1.25rem;
            border-top: 1px solid ${baseTheme.colors.gray[100]};
          `}
        >
          <p
            className={css`
              font-size: 0.875rem;
              line-height: 1.5;
              color: ${baseTheme.colors.gray[600]};
              margin: 0 0 0.75rem 0;
            `}
          >
            {t("email-communication-consent-checkbox-text")}
          </p>
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
            {t("status")}
          </div>
          <div
            data-testid="personal-info-email-consent-value"
            className={css`
              font-size: 0.9375rem;
              color: ${baseTheme.colors.gray[700]};
              font-weight: 500;
            `}
          >
            {emailCommunicationConsent ? t("yes") : t("no")}
          </div>
        </div>
      </div>
    )
  }

  return (
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
      <h3
        className={css`
          font-size: 1.0625rem;
          font-weight: 600;
          color: ${baseTheme.colors.gray[700]};
          margin: 0 0 1.25rem 0;
          padding-bottom: 1rem;
          border-bottom: 1px solid ${baseTheme.colors.gray[100]};
        `}
      >
        {t("user-settings-personal-info")}
      </h3>
      <form onSubmit={handleSubmit((data) => postUserCountryMutation.mutate(data))}>
        <div
          className={css`
            display: grid;
            gap: 1rem;
            ${respondToOrLarger.md} {
              grid-template-columns: repeat(2, 1fr);
              gap: 1.5rem;
            }
          `}
        >
          <TextField
            label={t("email")}
            placeholder={t("email")}
            {...register("email", {
              required: t("required-field"),
              validate: {
                isValidEmail: (value) =>
                  value.split("").indexOf("@") !== -1 || t("enter-a-valid-email"),
              },
            })}
            required
            error={errors.email}
          />

          <div></div>

          <TextField
            label={t("first-name")}
            placeholder={t("enter-first-name")}
            {...register("first_name", {
              required: t("required-field"),
            })}
            required
            error={errors.first_name}
          />

          <TextField
            label={t("last-name")}
            placeholder={t("enter-last-name")}
            {...register("last_name", {
              required: t("required-field"),
            })}
            required
            error={errors.last_name}
          />

          <Controller
            // eslint-disable-next-line i18next/no-literal-string
            name="country"
            control={control}
            rules={{ required: t("required-field") }}
            render={({ field }) => (
              <SearchableSelectField
                label={t("enter-country-question")}
                options={countriesOptions}
                onChangeByValue={field.onChange}
                value={field.value}
                required={true}
                error={errors.country?.message}
                placeholder={t("label-select-country")}
              />
            )}
          />
        </div>

        <div
          className={css`
            margin-top: 1rem;
          `}
        >
          <CheckBox
            className={css`
              padding-top: 8px;
            `}
            label={t("email-communication-consent-checkbox-text")}
            {...register("emailCommunicationConsent")}
          ></CheckBox>
        </div>

        <div
          className={css`
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
            padding-top: 1.5rem;
            margin-top: 1.5rem;
            border-top: 1px solid ${baseTheme.colors.gray[100]};
          `}
        >
          <Button
            variant="secondary"
            size="medium"
            type="button"
            onClick={handleCancel}
            disabled={postUserCountryMutation.isPending}
          >
            {t("button-text-cancel")}
          </Button>
          <Button
            variant="primary"
            size="medium"
            type="submit"
            disabled={postUserCountryMutation.isPending}
          >
            {t("button-text-save")}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default EditUserInformationForm
