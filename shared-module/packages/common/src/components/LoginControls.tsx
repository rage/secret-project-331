"use client"

import { cx } from "@emotion/css"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { Link } from "@/shared-module/components/components/Link"

import LoginStateContext from "../contexts/LoginStateContext"
import useLogout from "../hooks/useLogout"
import "../init/registerAuthApiClients"
import { useCurrentPagePathForReturnTo } from "../utils/redirectBackAfterLoginOrSignup"
import { loginRoute, signUpRoute } from "../utils/routes"
import Button from "./Button"
import Spinner from "./Spinner"

export interface LoginControlsProps {
  styles?: string[]
  currentPagePath: string
}

const LoginControls: React.FC<React.PropsWithChildren<LoginControlsProps>> = ({
  styles,
  currentPagePath,
}) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const returnTo = useCurrentPagePathForReturnTo(currentPagePath)
  const { logout } = useLogout()

  if (loginStateContext.isLoading) {
    return <Spinner variant="large" />
  }

  return loginStateContext.signedIn ? (
    <>
      <li className={cx(styles)}>
        <Link href="/user-settings" isCrossService styledAsButton size="medium" variant="primary">
          {t("user-settings")}
        </Link>
      </li>
      <li className={cx(styles)}>
        <Button size="medium" variant="primary" onClick={logout}>
          {t("log-out")}
        </Button>
      </li>
    </>
  ) : (
    <>
      <li className={cx(styles)}>
        <Link
          href={signUpRoute(returnTo)}
          isCrossService
          styledAsButton
          size="medium"
          variant="primary"
        >
          {t("create-new-account")}
        </Link>
      </li>
      <li className={cx(styles)}>
        <Link
          href={loginRoute(returnTo)}
          isCrossService
          styledAsButton
          size="medium"
          variant="primary"
        >
          {t("log-in")}
        </Link>
      </li>
    </>
  )
}

export default LoginControls
