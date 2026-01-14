"use client"

import { css } from "@emotion/css"
import React from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateUserInfo } from "@/services/backend/user-details"
import { UserDetail } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import SearchableSelectField from "@/shared-module/common/components/InputFields/SearchableSelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import countries from "@/shared-module/common/locales/en/countries.json"

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

  const {
    handleSubmit,
    formState: { errors },
    control,
    register,
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
    {},
  )

  return (
    <form onSubmit={handleSubmit((data) => postUserCountryMutation.mutate(data))}>
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

      <CheckBox
        className={css`
          padding-top: 8px;
        `}
        label={t("email-communication-consent-checkbox-text")}
        {...register("emailCommunicationConsent")}
      ></CheckBox>
      <div
        className={css`
          display: flex;
          justify-content: flex-end;
          padding-top: 16px;
        `}
      >
        <Button variant="primary" size="medium" type="submit">
          {t("button-text-save")}
        </Button>
      </div>
    </form>
  )
}

export default EditUserInformationForm
