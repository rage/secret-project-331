import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { fetchCountryFromIP, updateUserInfo } from "@/services/backend"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import SearchableSelectField from "@/shared-module/common/components/InputFields/SearchableSelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
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
  shouldAnswerMissingInfoForm: boolean
  setShouldAnswerMissingInfoForm: (shouldAnswerMissingInfoForm: boolean) => void
  email: string
  firstName: string
  lastName: string
  country: string | null
  emailCommunicationConsent: boolean
}

export const SelectUserInformationForm: React.FC<SelectUserInfoFormProps> = ({
  shouldAnswerMissingInfoForm,
  setShouldAnswerMissingInfoForm,
  email,
  firstName,
  lastName,
  country,
  emailCommunicationConsent,
}) => {
  const { t } = useTranslation()
  const { t: tCountries } = useTranslation("countries")

  const {
    handleSubmit,
    formState: { errors, isValid },
    control,
    reset,
    register,
    setValue,
    // eslint-disable-next-line i18next/no-literal-string
  } = useForm<SelectUserInfoFormFields>({ mode: "onChange" })

  const countriesOptions = React.useMemo(
    () =>
      Object.entries(countries).map(([code]) => ({
        value: code,
        label: tCountries(code as keyof typeof countries),
      })),
    [tCountries],
  )
  const selectedCountry = countriesOptions.find((opt) => opt.value === country)?.label

  const preFillCountry = useQuery({
    queryKey: [`users-ip-country`],
    queryFn: () => fetchCountryFromIP(),
  })

  useEffect(() => {
    setValue("email", email)
  }, [email, setValue])

  useEffect(() => {
    const currentCountry = country ?? preFillCountry.data
    if (currentCountry) {
      reset((prevValues) => {
        if (prevValues.country !== currentCountry) {
          return { ...prevValues, country: currentCountry }
        }
        return prevValues
      })
    }
  }, [country, preFillCountry.data, reset])
  const postUserCountryMutation = useToastMutation<unknown, unknown, SelectUserInfoFormFields>(
    async (data) => {
      const { email, first_name, last_name, country, emailCommunicationConsent } = data
      await updateUserInfo(email, first_name, last_name, country, emailCommunicationConsent)
    },

    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        setShouldAnswerMissingInfoForm(false)
      },
    },
  )

  if (!shouldAnswerMissingInfoForm) {
    return null
  }

  return (
    <>
      <StandardDialog
        showCloseButton={false}
        closeable={false}
        open={shouldAnswerMissingInfoForm}
        onClose={() => setShouldAnswerMissingInfoForm(false)}
        aria-label={t("enter-country-question")}
        title={t("title-fill-missing-information")}
        buttons={[
          {
            type: "submit",
            disabled: postUserCountryMutation.isPending || !isValid,
            // eslint-disable-next-line i18next/no-literal-string
            className: "primary-button",
            // eslint-disable-next-line i18next/no-literal-string
            variant: "primary",
            children: t("save"),
            onClick: handleSubmit((data) => postUserCountryMutation.mutate(data)),
          },
        ]}
      >
        <form onSubmit={handleSubmit((data) => postUserCountryMutation.mutate(data))}>
          <TextField
            label={t("first-name")}
            defaultValue={firstName}
            placeholder={t("enter-first-name")}
            {...register("first_name", {
              required: t("required-field"),
            })}
            required={true}
            error={errors.first_name}
          />

          <TextField
            label={t("last-name")}
            defaultValue={lastName}
            placeholder={t("enter-last-name")}
            {...register("last_name", {
              required: t("required-field"),
            })}
            required={true}
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
                error={errors.country?.message}
                required={true}
                placeholder={selectedCountry ?? t("select-a-country")}
              />
            )}
          />

          <CheckBox
            className={css`
              margin-top: 1rem;
            `}
            label={t("email-communication-consent-checkbox-text")}
            defaultChecked={emailCommunicationConsent}
            {...register("emailCommunicationConsent")}
          ></CheckBox>
        </form>
      </StandardDialog>
    </>
  )
}

export default SelectUserInformationForm
