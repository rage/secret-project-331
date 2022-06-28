import styled from "@emotion/styled"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createUser } from "../services/backend/auth"
import { baseTheme, headingFont } from "../styles"

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
  padding: 4rem 4rem;
  font-family: ${headingFont};
  border-radius: 4px;

  @media (max-width: 767.98px) {
    padding: 4rem 0rem;
  }

  h2 {
    font-size: clamp(30px, 3vw, 40px);
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
    padding: 12px;
    transition: ease-in-out, width 0.35s ease-in-out;
    outline: none;
    min-width: 20px;
    width: 100%;
    display: inline-block;
    font-size: 18px;
    margin-bottom: 20px;

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
    margin-top: 30px;
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

const CreateAccountForm = () => {
  // eslint-disable-next-line i18next/no-literal-string
  const { register, formState, watch, handleSubmit } = useForm({ mode: "onChange" })
  const { errors, isValid, isSubmitting } = formState

  const [submitError, setSubmitError] = useState(false)

  const { t, i18n } = useTranslation()

  // eslint-disable-next-line i18next/no-literal-string
  const password = watch("password")

  return (
    <Wrapper>
      <h2>{t("create-new-account")}</h2>
      <span className="description">{t("sign-up-with-mooc-subtitle")}</span>
      {submitError && <div>{submitError}</div>}
      <form
        onSubmit={handleSubmit(async (data) => {
          const { first_name, last_name, email, password, password_confirmation } = data
          try {
            await createUser({
              email: email,
              first_name: first_name,
              last_name: last_name,
              language: i18n.language,
              password: password,
              password_confirmation: password_confirmation,
            })
          } catch (error) {
            // eslint-disable-next-line i18next/no-literal-string
            console.log("error", error)
            setSubmitError(true)
          }
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
                  message: t("password-must-have-at-least-8-digit"),
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
                  message: t("password-must-have-at-least-8-digit"),
                },
                validate: {
                  passwordMatch: (value) => value === password || t("password-dont-match"),
                },
              })}
            />
            {errors.password_confirmation && (
              // eslint-disable-next-line i18next/no-literal-string
              <ErrorMessage>&#9888; {`${errors.password_confirmation.message}`}</ErrorMessage>
            )}
          </div>
        </fieldset>
        <input disabled={!isValid} value={t("create-an-acount")} type="submit" />
      </form>
      <span className="signin-link">
        <a href="https://courses.mooc.fi/login">{t("sign-in-if-you-have-an-account")}</a>
      </span>
    </Wrapper>
  )
}

export default CreateAccountForm
