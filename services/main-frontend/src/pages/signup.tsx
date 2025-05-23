import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { Envelope } from "@vectopus/atlas-icons-react"
import { useRouter } from "next/router"
import { useContext, useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import ResearchOnCoursesForm from "../components/forms/ResearchOnCoursesForm"

import { fetchCountryFromIP } from "@/services/backend/user-details"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SearchableSelect from "@/shared-module/common/components/InputFields/SearchableSelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import countries from "@/shared-module/common/locales/en/countries.json"
import { createUser } from "@/shared-module/common/services/backend/auth"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import {
  useCurrentPagePathForReturnTo,
  validateReturnToRouteOrDefault,
} from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"

interface FormFields {
  first_name: string
  last_name: string
  email: string
  password: string
  password_confirmation: string
  country: string
}

const Wrapper = styled.div`
  max-width: 1200px;
  position: relative;
  margin: 0 auto;
  display: block;
  padding: 2rem 2rem;
  font-family: ${headingFont};
  border-radius: 4px;

  @media (max-width: 767.98px) {
    padding: 2rem 0rem;
  }

  h1 {
    font-size: clamp(30px, 3vw, 34px);
    color: ${baseTheme.colors.gray[700]};
    text-align: center;
    font-family: ${headingFont};
    font-weight: 600;
  }

  .description {
    font-size: 20px;
    display: inline-block;
    text-align: center;
    margin: 0.5rem 0 2rem 0;
    a {
      color: #065853;
      font-weight: 600;
      text-decoration: none;
    }
  }

  fieldset {
    border: none;
    margin: 0;
    padding: 0;
  }

  input[type="submit"] {
    height: 60px;
    background: #46749b;
    color: #fff;
    font-weight: bold;
    font-size: 22px;
    padding: 15px 10px;
    line-height: 1.2;
    font-family: ${headingFont} !important;
    justify-content: center;
    align-items: center;
    border: none;
    width: 100%;
    margin: 1rem 0;

    &:hover {
      background: #215887;
    }
  }

  input[type="submit"]:disabled {
    background: #ebedee;
    color: #989ca3;
  }

  .signin-link {
    display: block;
    text-align: center;
    margin: 0 auto;

    a {
      text-decoration: none;
      font-size: 20px;
      color: ${baseTheme.colors.gray[700]};

      &:hover {
        color: ${baseTheme.colors.blue[700]};
      }
    }
  }
`

const CreateAccountForm: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { register, formState, watch, reset, handleSubmit, trigger, control } = useForm<FormFields>(
    {
      // eslint-disable-next-line i18next/no-literal-string
      mode: "onChange",
    },
  )

  const preFillCountry = useQuery({
    queryKey: [`users-ip-country`],
    queryFn: () => fetchCountryFromIP(),
  })

  useEffect(() => {
    if (preFillCountry.data) {
      reset({ country: preFillCountry.data })
    }
  }, [preFillCountry.data, reset])

  const loginStateContext = useContext(LoginStateContext)
  const router = useRouter()
  const uncheckedReturnTo = useQueryParameter("return_to")
  const returnToForLinkToLoginPage = useCurrentPagePathForReturnTo(router.asPath)
  const { errors, isValid, isSubmitting } = formState

  const [confirmEmailPageVisible, setConfirmEmailPageVisible] = useState(false)

  const { t, i18n } = useTranslation()

  const password = watch("password")
  const passwordConfirmation = watch("password_confirmation")

  const createAccountMutation = useToastMutation<unknown, unknown, FormFields>(
    async (data) => {
      const { first_name, last_name, email, password, password_confirmation, country } = data
      await createUser({
        email: email,
        first_name: first_name,
        last_name: last_name,
        language: i18n.language,
        password: password,
        password_confirmation: password_confirmation,
        country: country,
      })
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        reset({
          first_name: "",
          last_name: "",
          email: "",
          password: "",
          password_confirmation: "",
          country: "",
        })
        setConfirmEmailPageVisible(true)
        loginStateContext.refresh()
      },
    },
  )

  useEffect(() => {
    if (loginStateContext.signedIn && !confirmEmailPageVisible) {
      router.push("/")
    }
  })

  useEffect(() => {
    // Make sure that password_confirmation is revalidated when the password changes.
    if (password && password !== "" && passwordConfirmation && passwordConfirmation !== "") {
      // eslint-disable-next-line i18next/no-literal-string
      trigger("password_confirmation")
    }
  }, [password, passwordConfirmation, trigger])

  const { t: tCountries } = useTranslation("countries")
  const countriesNames = Object.entries(countries).map(([code]) => ({
    value: code,
    label: tCountries(code as keyof typeof countries),
  }))

  if (confirmEmailPageVisible) {
    return (
      <Wrapper>
        <h1>{t("message-please-confirm-your-email-address")}</h1>
        <div
          className={css`
            margin: 2rem 0;
            padding: 1rem;
            background-color: ${baseTheme.colors.green[100]};
            line-height: 1.7;
            display: flex;
            align-items: center;
          `}
        >
          <Envelope
            size={32}
            className={css`
              font-size: 2rem;
              margin-right: 1rem;
            `}
          />
          <div>
            <p>
              {t("confirm-email-address-instructions-1")}{" "}
              <strong>{t("confirm-email-address-instructions-2")}</strong>{" "}
              {t("confirm-email-address-instructions-3")}
            </p>
            <p></p>
          </div>
        </div>
        <Button
          variant="primary"
          size="medium"
          onClick={() => {
            const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
            router.push(returnTo)
          }}
        >
          {t("button-text-done")}
        </Button>
        {<ResearchOnCoursesForm />}
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <h1>{t("create-new-account")}</h1>
      <span className="description">{t("sign-up-with-mooc-subtitle")}</span>
      <form
        onSubmit={handleSubmit(async (data, event) => {
          event?.preventDefault()
          createAccountMutation.mutate(data)
        })}
      >
        <fieldset disabled={isSubmitting}>
          <TextField
            label={t("first-name")}
            placeholder={t("enter-first-name")}
            {...register("first_name", {
              required: t("required-field"),
            })}
            required={true}
            error={errors.first_name}
          />

          <TextField
            label={t("last-name")}
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
              <SearchableSelect
                label={t("enter-country-question")}
                options={countriesNames}
                onChangeByValue={(value) => field.onChange(value)}
                value={field.value}
                error={errors.country?.message}
              />
            )}
          />

          <TextField
            label={t("email")}
            type="email"
            placeholder={t("enter-your-email")}
            {...register("email", {
              required: t("required-field"),
              validate: {
                isValidEmail: (value) =>
                  value.split("").indexOf("@") !== -1 || t("enter-a-valid-email"),
              },
            })}
            required={true}
            error={errors.email}
          />
          <TextField
            label={t("password")}
            type="password"
            placeholder={t("enter-your-password")}
            {...register("password", {
              required: t("required-field"),
              minLength: {
                value: 8,
                message: t("password-must-have-at-least-8-characters"),
              },
            })}
            required={true}
            error={errors.password}
          />

          <TextField
            label={t("confirm-password")}
            type="password"
            placeholder={t("confirm-your-password")}
            {...register("password_confirmation", {
              required: t("required-field"),
              minLength: {
                value: 8,
                message: t("password-must-have-at-least-8-characters"),
              },
              validate: {
                passwordMatch: (value) => value === password || t("passwords-dont-match"),
              },
            })}
            required={true}
            error={errors.password_confirmation}
          />
        </fieldset>
        <input
          disabled={!isValid || createAccountMutation.isPending}
          value={t("create-an-acount")}
          type="submit"
        />
      </form>
      <span className="signin-link">
        <a href={`/login?return_to=${encodeURIComponent(returnToForLinkToLoginPage)}`}>
          {t("sign-in-if-you-have-an-account")}
        </a>
      </span>
      {createAccountMutation.isError && (
        <ErrorBanner variant={"text"} error={createAccountMutation.error} />
      )}
    </Wrapper>
  )
}

export default CreateAccountForm
