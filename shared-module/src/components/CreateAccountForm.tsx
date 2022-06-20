/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont, secondaryFont } from "../styles"

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
    padding: 14px 12px;
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
    font-weight: 500;
    font-size: 22px;
    padding: 16px 10px;
    line-height: 1.2;
    font-family: ${secondaryFont} !important;
    justify-content: center;
    align-items: center;
    border: none;
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

const SUBTITLE =
  "If you have previously taken mooc.fi courses, you can use your existing IDs on the login page. On this page you can create a new ID that works in most mooc.fi courses and services."

const CreateAccountForm = () => {
  // eslint-disable-next-line i18next/no-literal-string
  const { register, formState, watch, handleSubmit } = useForm({ mode: "onChange" })
  const { errors, isValid, isSubmitting } = formState

  const [submitError, setSubmitError] = useState(false)

  const { t } = useTranslation()

  const password = watch("password")

  const onSubmit = (data: any) => {
    /*   try {
      await createAccount({
        email: data.email,
        password: data.password,
        password_confirmation: data.passwordConfirmation,
      })
      await authenticate({
        username: data.email,
        password: data.password,
      })
      props.onComplete()
    } catch (error) {
      try {
        let message = ""
        Object.entries(error).forEach((o) => {
          const key = o[0]
          const value = o[1]
          value.forEach((msg) => {
            let newMessage = capitalizeFirstLetter(`${key.replace(/_/g, " ")} ${msg}.`)
            if (newMessage === "Email has already been taken.") {
              newMessage = this.props.t("emailInUse")
            }
            message = `${message} ${newMessage}`
          })
        })

        if (message === "") {
          message = this.props.t("problemCreatingAccount") + JSON.stringify(error)
        }
        this.setState({ error: message, submitting: false, errorObj: error })
      } catch (_error2) {
        this.setState({ error: JSON.stringify(error), submitting: false })
      }

      this.setState({ submitting: false })
    } */
  }

  return (
    <Wrapper>
      <h2>{t("create-new-account")}</h2>
      <span className="description">
        This course uses <a href="https://www.mooc.fi/en/">mooc.fi</a> usernames. {SUBTITLE}
      </span>
      {submitError && <div>Virhe lähetyksessä</div>}
      <form onSubmit={handleSubmit(onSubmit)}>
        <fieldset /* disabled={submitting} */>
          <div key="email">
            <label htmlFor="email">{t("email")}</label>
            <input
              placeholder={t("enter-your-email")}
              type="email"
              {...register("email", {
                required: t("required-field"),
                validate: {
                  //will change to regex for a more extensive validdation
                  isValidEmail: (value) =>
                    (value.split("").indexOf("@") !== -1 && value.split("").indexOf(".") !== -1) ||
                    t("enter-a-valid-email"),
                },
              })}
            />
            {errors.email && <ErrorMessage>&#9888; {`${errors.email.message}`}</ErrorMessage>}
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
            {errors.password && <ErrorMessage>&#9888; {`${errors.password.message}`}</ErrorMessage>}
          </div>
          <div key="passwordConfirmation">
            <label htmlFor="passwordConfirmation">{t("confirm-password")}</label>
            <input
              placeholder={t("confirm-your-password")}
              type="password"
              {...register("passwordConfirmation", {
                required: t("required-field"),
                minLength: {
                  value: 8,
                  message: t("password-must-have-at-least-8-digit"),
                },
                validate: {
                  passwordMatch: (value) => value !== password || t("password-dont-match"),
                },
              })}
            />
            {errors.passwordConfirmation && (
              // eslint-disable-next-line i18next/no-literal-string
              <ErrorMessage>&#9888; {`${errors.passwordConfirmation.message}`}</ErrorMessage>
            )}
          </div>
        </fieldset>
        <input
          /* disabled={!isValid} */ value={t("create-an-acount").toUpperCase()}
          type="submit"
        />
      </form>
      <span className="signin-link">
        <a href="/">{t("sign-in-if-you-have-an-account")}</a>
      </span>
    </Wrapper>
  )
}

export default CreateAccountForm
