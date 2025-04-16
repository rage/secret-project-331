import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateUserCountry } from "@/services/backend"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import countries from "@/shared-module/common/locales/en/countries.json"

type SelectUserCountryFormFields = {
  country: string
}

type SelectUserCountryFormProps = {
  shouldAnswerUserCountryForm: boolean
  setShouldAnswerUserCountryForm: (shouldAnswerUserCountryForm: boolean) => void
}

export const SelectUserCountryForm: React.FC<SelectUserCountryFormProps> = ({
  shouldAnswerUserCountryForm,
  setShouldAnswerUserCountryForm,
}) => {
  const { t } = useTranslation()
  const { t: tCountries } = useTranslation("countries")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SelectUserCountryFormFields>()

  const countriesOptions = Object.entries(countries).map(([code]) => ({
    value: code,
    label: tCountries(code as keyof typeof countries),
  }))

  const postUserCountryMutation = useToastMutation(
    (country: string) => updateUserCountry(country),
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        setShouldAnswerUserCountryForm(false)
      },
    },
  )
  if (!shouldAnswerUserCountryForm) {
    return null
  }

  return (
    <StandardDialog
      open={shouldAnswerUserCountryForm}
      title={t("enter-country-question")}
      showCloseButton={false}
      buttons={[
        {
          // eslint-disable-next-line i18next/no-literal-string
          variant: "primary",
          onClick: handleSubmit((data) => postUserCountryMutation.mutate(data.country)),
          disabled: postUserCountryMutation.isPending,
          children: t("save"),
        },
      ]}
    >
      <SelectField
        label={t("enter-country-question")}
        options={countriesOptions}
        {...register("country", { required: true })}
        error={errors.country?.message}
      />
    </StandardDialog>
  )
}

export default SelectUserCountryForm
