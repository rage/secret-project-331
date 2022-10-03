import { ClassNamesArg, cx } from "@emotion/css"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import LoginStateContext from "../contexts/LoginStateContext"
import { logout } from "../services/backend/auth"
import { useCurrentPagePathForReturnTo } from "../utils/redirectBackAfterLoginOrSignup"

import Button from "./Button"
import Spinner from "./Spinner"

export interface LoginControlsProps {
  styles?: ClassNamesArg[]
  currentPagePath: string
}

const LoginControls: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<LoginControlsProps>>
> = ({ styles, currentPagePath }) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const returnTo = useCurrentPagePathForReturnTo(currentPagePath)

  if (loginStateContext.isLoading) {
    return <Spinner variant="large" />
  }

  const submitLogout = async () => {
    await logout()
    await loginStateContext.refresh()
  }

  // eslint-disable-next-line i18next/no-literal-string
  const loginPathWithReturnTo = `/login?return_to=${encodeURIComponent(returnTo)}`

  // eslint-disable-next-line i18next/no-literal-string
  const signUpPathWithReturnTo = `/signup?return_to=${encodeURIComponent(returnTo)}`

  return loginStateContext.signedIn ? (
    <>
      <li className={cx(styles)}>
        <Button size="medium" variant="primary" onClick={submitLogout}>
          {t("log-out")}
        </Button>
      </li>
    </>
  ) : (
    <>
      <li className={cx(styles)}>
        <a href={signUpPathWithReturnTo}>
          <Button size="medium" variant="primary">
            {t("create-new-account")}
          </Button>
        </a>
      </li>
      <li className={cx(styles)}>
        <a href={loginPathWithReturnTo}>
          <Button size="medium" variant="primary">
            {t("log-in")}
          </Button>
        </a>
      </li>
    </>
  )
}

export default LoginControls
