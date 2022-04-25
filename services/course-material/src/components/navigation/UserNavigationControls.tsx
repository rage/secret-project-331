import { ClassNamesArg, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { faUser as profileIcon } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../../shared-module/components/Button"
import Spinner from "../../shared-module/components/Spinner"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { logout } from "../../shared-module/services/backend/auth"
import SelectCourseInstanceModal from "../modals/SelectCourseInstanceModal"

const StyledIcon = styled(FontAwesomeIcon)`
  margin-right: 0.5rem;
`

export interface UserNavigationControlsProps {
  styles?: ClassNamesArg[]
  returnToPath?: string
  courseId?: string | null
}

const UserNavigationControls: React.FC<UserNavigationControlsProps> = ({
  styles,
  returnToPath,
  courseId,
}) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const [showSettings, setShowSettings] = useState<boolean>(false)

  if (loginStateContext.isLoading) {
    return <Spinner variant="large" />
  }

  const submitLogout = async () => {
    await logout()
    await loginStateContext.refresh()
  }

  return loginStateContext.signedIn ? (
    <>
      {showSettings && (
        <SelectCourseInstanceModal
          onClose={() => {
            setShowSettings(false)
          }}
          manualOpen={showSettings}
        />
      )}
      <li className={cx(styles)}>
        <Button size="medium" variant="primary">
          <StyledIcon icon={profileIcon} />
          {t("email")}
        </Button>
      </li>
      {courseId && (
        <li>
          <Button
            size="medium"
            variant="primary"
            onClick={() => {
              setShowSettings(true)
            }}
          >
            {t("settings")}
          </Button>
        </li>
      )}
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

export default UserNavigationControls
