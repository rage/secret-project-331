import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { fetchCountryFromIP, updateUserInfo } from "@/services/backend"
import SearchableSelectField from "@/shared-module/common/components/InputFields/SearchableSelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import countries from "@/shared-module/common/locales/en/countries.json"

type SelectUserCountryFormFields = {
  first_name: string
  last_name: string
  country: string
}

type SelectUserCountryFormProps = {
  shouldAnswerMissingInfoForm: boolean
  setShouldAnswerMissingInfoForm: (shouldAnswerMissingInfoForm: boolean) => void
  firstName: string
  lastName: string
  country: string | null
}

export const SelectUserCountryForm: React.FC<SelectUserCountryFormProps> = ({
  shouldAnswerMissingInfoForm,
  setShouldAnswerMissingInfoForm,
  firstName,
  lastName,
  country,
}) => {
  const { t } = useTranslation()
  const { t: tCountries } = useTranslation("countries")

  const {
    handleSubmit,
    formState: { errors },
    control,
    reset,
    register,
  } = useForm<SelectUserCountryFormFields>()

  const countriesOptions = Object.entries(countries).map(([code]) => ({
    value: code,
    label: tCountries(code as keyof typeof countries),
  }))

  const preFillCountry = useQuery({
    queryKey: [`users-ip-country`],
    queryFn: () => fetchCountryFromIP(),
  })

  useEffect(() => {
    if (country != null) {
      reset({ country: country })
    } else if (preFillCountry.data) {
      reset({ country: preFillCountry.data })
    }
  }, [country, preFillCountry.data, reset])

  const postUserCountryMutation = useToastMutation<unknown, unknown, SelectUserCountryFormFields>(
    async (data) => {
      const { first_name, last_name, country } = data
      await updateUserInfo(first_name, last_name, country)
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
      {shouldAnswerMissingInfoForm && (
        <StandardDialog
          showCloseButton={false}
          open={shouldAnswerMissingInfoForm}
          onClose={() => setShouldAnswerMissingInfoForm(false)}
          aria-label={t("enter-country-question")}
          // eslint-disable-next-line i18next/no-literal-string
          title={"Please fill missing information"}
          buttons={[
            {
              type: "submit",
              disabled: postUserCountryMutation.isPending,
              // eslint-disable-next-line i18next/no-literal-string
              className: "primary-button",
              // eslint-disable-next-line i18next/no-literal-string
              variant: "primary",
              children: t("save"),
            },
          ]}
        >
          <form
            onSubmit={handleSubmit(async (data, event) => {
              event?.preventDefault()
              postUserCountryMutation.mutate(data)
            })}
          >
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
                />
              )}
            />
          </form>
        </StandardDialog>
      )}
    </>
  )
}

export default SelectUserCountryForm
