import { ClassNamesArg, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { faUser as profileIcon } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import LoginStateContext from "../contexts/LoginStateContext"
import { logout } from "../services/backend/auth"

import Button from "./Button"
import Spinner from "./Spinner"

const StyledIcon = styled(FontAwesomeIcon)`
  margin-right: 0.5rem;
`

export interface LoginControlsProps {
  styles?: ClassNamesArg[]
  returnToPath?: string
}

const LoginControls: React.FC<LoginControlsProps> = ({ styles, returnToPath }) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)

  if (loginStateContext.isLoading) {
    return <Spinner variant="large" />
  }

  const submitLogout = async () => {
    await logout()
    await loginStateContext.refresh()
  }

  return loginStateContext.signedIn ? (
    <>
      <li className={cx(styles)}>
        <Button size="medium" variant="primary">
          <StyledIcon icon={profileIcon} />
          {t("email")}
        </Button>
      </li>
      <li className={cx(styles)}>
        <Button size="medium" variant="primary" onClick={submitLogout}>
          {t("log-out")}
        </Button>
      </li>
    </>
  ) : (
    <>
      <li className={cx(styles)}>
        <Button size="medium" variant="primary">
          {t("create-new-account")}
        </Button>
      </li>
      <li className={cx(styles)}>
        <a href={returnToPath}>
          <Button size="medium" variant="primary">
            {t("log-in")}
          </Button>
        </a>
      </li>
    </>
  )
}

export default LoginControls
