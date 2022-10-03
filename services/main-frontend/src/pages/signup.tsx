import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faEnvelope as emailIcon } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useRouter } from "next/router"
import { useContext, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Layout from "../components/Layout"
import Button from "../shared-module/components/Button"
import ErrorBanner from "../shared-module/components/ErrorBanner"
import LoginStateContext from "../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../shared-module/hooks/useQueryParameter"
import useToastMutation from "../shared-module/hooks/useToastMutation"
import { createUser } from "../shared-module/services/backend/auth"
import { baseTheme, headingFont } from "../shared-module/styles"
import {
  useCurrentPagePathForReturnTo,
  validateReturnToRouteOrDefault,
} from "../shared-module/utils/redirectBackAfterLoginOrSignup"

interface FormFields {
  first_name: string
  last_name: string
  email: string
  password: string
  password_confirmation: string
}

const ErrorMessage = styled.div`
  color: #ed5565;
  font-size: 14px;
  margin-top: -10px;
  margin-bottom: 10px;
  padding: 0;
`

// eslint-disable-next-line i18next/no-literal-string
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
    color: ${baseTheme.colors.grey[700]};
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

  input {
    background: #fcfcfc;
    border-width: 1.6px;
    border-style: solid;
    border-color: #bec3c7;
    padding: 10px;
    transition: ease-in-out, width 0.35s ease-in-out;
    outline: none;
    min-width: 20px;
    width: 100%;
    display: inline-block;
    font-size: 18px;
    margin-bottom: 14px;

    &:focus,
    &:active {
      border-color: #55b3f5;
    }

    @media (max-width: 767.98px) {
      padding: 10px 8px;
    }
  }

  label {
    display: inline-block;
    font-size: 17px;
    margin-bottom: 5px;
  }

  input[type="submit"] {
    height: 60px;
    margin-top: 24px;
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
      color: ${baseTheme.colors.grey[700]};

      &:hover {
        color: ${baseTheme.colors.blue[700]};
      }
    }
  }
`

const CreateAccountForm: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { register, formState, watch, reset, handleSubmit } = useForm<FormFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
  })
  const loginStateContext = useContext(LoginStateContext)
  const router = useRouter()
  const uncheckedReturnTo = useQueryParameter("return_to")
  const returnToForLinkToLoginPage = useCurrentPagePathForReturnTo(router.asPath)
  const { errors, isValid, isSubmitting } = formState

  const [confirmEmailPageVisible, setConfirmEmailPageVisible] = useState(false)

  const { t, i18n } = useTranslation()

  // eslint-disable-next-line i18next/no-literal-string
  const password = watch("password")

  const createAccountMutation = useToastMutation<unknown, unknown, FormFields>(
    async (data) => {
      const { first_name, last_name, email, password, password_confirmation } = data
      await createUser({
        email: email,
        first_name: first_name,
        last_name: last_name,
        language: i18n.language,
        password: password,
        password_confirmation: password_confirmation,
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

  if (confirmEmailPageVisible) {
    return (
      <Layout>
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
            <FontAwesomeIcon
              icon={emailIcon}
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
        </Wrapper>
      </Layout>
    )
  }

  return (
    <Layout>
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
            <div key="first_name">
              <label htmlFor="first_name">{t("first-name")}</label>
              <input
                placeholder={t("enter-first-name")}
                type="first_name"
                {...register("first_name", {
                  required: t("required-field"),
                })}
              />
              {errors.first_name && (
                // eslint-disable-next-line i18next/no-literal-string
                <ErrorMessage>&#9888; {`${errors.first_name.message}`}</ErrorMessage>
              )}
            </div>
            <div key="last_name">
              <label htmlFor="last_name">{t("last-name")}</label>
              <input
                placeholder={t("enter-last-name")}
                type="last_name"
                {...register("last_name", {
                  required: t("required-field"),
                })}
              />
              {errors.last_name && (
                // eslint-disable-next-line i18next/no-literal-string
                <ErrorMessage>&#9888; {`${errors.last_name.message}`}</ErrorMessage>
              )}
            </div>
            <div key="email">
              <label htmlFor="email">{t("email")}</label>
              <input
                placeholder={t("enter-your-email")}
                type="email"
                {...register("email", {
                  required: t("required-field"),
                  validate: {
                    isValidEmail: (value) =>
                      value.split("").indexOf("@") !== -1 || t("enter-a-valid-email"),
                  },
                })}
              />
              {errors.email && (
                // eslint-disable-next-line i18next/no-literal-string
                <ErrorMessage>&#9888; {`${errors.email.message}`}</ErrorMessage>
              )}
            </div>
            <div key="password">
              <label htmlFor="password">{t("password")}</label>
              <input
                placeholder={t("enter-your-password")}
                type="password"
                {...register("password", {
                  required: t("required-field"),
                  minLength: {
                    value: 8,
                    message: t("password-must-have-at-least-8-characters"),
                  },
                })}
              />
              {errors.password && (
                // eslint-disable-next-line i18next/no-literal-string
                <ErrorMessage>&#9888; {`${errors.password.message}`}</ErrorMessage>
              )}
            </div>
            <div key="password_confirmation">
              <label htmlFor="password_confirmation">{t("confirm-password")}</label>
              <input
                placeholder={t("confirm-your-password")}
                type="password"
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
              />
              {errors.password_confirmation && (
                // eslint-disable-next-line i18next/no-literal-string
                <ErrorMessage>&#9888; {`${errors.password_confirmation.message}`}</ErrorMessage>
              )}
            </div>
          </fieldset>
          <input
            disabled={!isValid || createAccountMutation.isLoading}
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
    </Layout>
  )
}

export default CreateAccountForm
