"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getCourseMaterialCountryFromIpOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { updateCourseMaterialUserInfo } from "@/generated/course-material-api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import countries from "@/shared-module/common/locales/en/countries.json"
import { Checkbox, Dialog, Select, TextField } from "@/shared-module/components"

interface SelectUserInfoFormFields {
  email: string
  first_name: string
  last_name: string
  country: string
  emailCommunicationConsent: boolean
}

interface SelectUserInfoFormProps {
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
    formState: { isValid },
    control,
    reset,
    setValue,
  } = useForm<SelectUserInfoFormFields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      email,
      first_name: firstName,
      last_name: lastName,
      country: country ?? "",
      emailCommunicationConsent,
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

  const preFillCountry = useQuery({
    ...getCourseMaterialCountryFromIpOptions({}),
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
      const {
        email: submittedEmail,
        first_name,
        last_name,
        country: submittedCountry,
        emailCommunicationConsent: submittedEmailConsent,
      } = data
      await updateCourseMaterialUserInfo({
        body: {
          country: submittedCountry,
          email: submittedEmail,
          email_communication_consent: submittedEmailConsent,
          first_name,
          last_name,
        },
      })
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
    <Dialog
      showCloseButton={false}
      open={shouldAnswerMissingInfoForm}
      onClose={() => setShouldAnswerMissingInfoForm(false)}
      title={t("title-fill-missing-information")}
      actions={[
        {
          type: "submit",
          disabled: postUserCountryMutation.isPending || !isValid,
          variant: "primary",
          label: t("save"),
          onClick: handleSubmit((data) => postUserCountryMutation.mutate(data)),
        },
      ]}
    >
      <form onSubmit={handleSubmit((data) => postUserCountryMutation.mutate(data))}>
        <TextField
          name="first_name"
          control={control}
          rules={{ required: t("required-field") }}
          label={t("first-name")}
          isRequired
        />

        <TextField
          name="last_name"
          control={control}
          rules={{ required: t("required-field") }}
          label={t("last-name")}
          isRequired
        />

        <Select
          name="country"
          control={control}
          rules={{ required: t("required-field") }}
          label={t("enter-country-question")}
          options={countriesOptions}
          isRequired
          searchEnabled
          placeholder={t("select-a-country")}
        />

        <Checkbox
          name="emailCommunicationConsent"
          control={control}
          className={css`
            margin-top: 1rem;
          `}
          label={t("email-communication-consent-checkbox-text")}
        />
      </form>
    </Dialog>
  )
}

export default SelectUserInformationForm
