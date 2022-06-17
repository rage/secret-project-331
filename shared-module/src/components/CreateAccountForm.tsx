/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { headingFont } from "../styles"

const ErrorMessage = styled.div`
  color: #ed5565;
  font-size: 14px;
  margin-top: -10px;
  margin-bottom: 10px;
  padding: 0;
`

const Wrapper = styled.div`
  max-width: 600px;
  position: relative;
  margin: 0 auto;
  display: block;
  padding: 4rem 4rem;
  font-family: ${headingFont};
  border-radius: 4px;
`

const SUBTITLE =
  "This course uses mooc.fi usernames. If you have previously taken mooc.fi courses, you can use your existing IDs on the login page. On this page you can create a new ID that works in most mooc.fi courses and services."

const CreateAccountForm = () => {
  // eslint-disable-next-line i18next/no-literal-string
  const { register, formState, watch, handleSubmit } = useForm({ mode: "onChange" })
  const { errors, isValid, isDirty, isSubmitting, touchedFields, submitCount } = formState

  const [submitError, setSubmitError] = useState(false)

  const { t } = useTranslation()

  const password = watch("password")

  /*   const onSubmit = (data, event) => console.log(data, e)
  const onError = (errors, event) => console.log(errors, e) */

  const onSubmit = (data) => {
    console.log("DATA", data)
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
      <span>{SUBTITLE}</span>
      {submitError && <div>Virhe lähetyksessä</div>}
      <form onSubmit={handleSubmit(onSubmit)}>
        <fieldset /* disabled={submitting} */>
          <div key="email">
            <label htmlFor="email">Email</label>
            <input
              name="email"
              placeholder="Enter your email"
              type="email"
              {...register("email", {
                required: "This field is required",
                validate: {
                  isValidEmail: (value) =>
                    (value.split("").indexOf("@") !== -1 && value.split("").indexOf(".") !== -1) ||
                    "Enter a valid email!",
                },
              })}
            />
            {errors.email && <ErrorMessage>&#9888; {`${errors.email.message}`}</ErrorMessage>}
          </div>
          <div key="password">
            <label htmlFor="password">Password</label>
            <input
              name="password"
              placeholder="Enter your password"
              type="password"
              {...register("password", {
                required: "This field is required",
                minLength: {
                  value: 8,
                  message: "Password must have at least 8 characters!",
                },
              })}
            />
            {errors.password && <ErrorMessage>&#9888; {`${errors.password.message}`}</ErrorMessage>}
          </div>
          <div key="passwordConfirmation">
            <label htmlFor="passwordConfirmation">Confirm Password</label>
            <input
              name="passwordConfirmation"
              placeholder="Enter your password again"
              type="password"
              {...register("passwordConfirmation", {
                required: "This field is required",
                minLength: {
                  value: 8,
                  message: "Password must have at least 8 characters",
                },
                validate: {
                  passwordMatch: (value) => value !== password || "password doesn't match!",
                },
              })}
            />
            {errors.passwordConfirmation && (
              <ErrorMessage>&#9888; {`${errors.passwordConfirmation.message}`}</ErrorMessage>
            )}
          </div>
        </fieldset>
        <input /* disabled={!isValid} */ value="CREATE AN ACCOUNT" type="submit" />
      </form>
    </Wrapper>
  )
}

export default CreateAccountForm
