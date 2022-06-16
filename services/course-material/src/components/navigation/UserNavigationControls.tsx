import { ClassNamesArg, cx } from "@emotion/css"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../../shared-module/components/Button"
import Spinner from "../../shared-module/components/Spinner"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { logout } from "../../shared-module/services/backend/auth"
import SelectCourseInstanceModal from "../modals/SelectCourseInstanceModal"

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
        <a href="https://www.mooc.fi/en/sign-up/">
          <Button size="medium" variant="primary">
            {t("create-new-account")}
          </Button>
        </a>
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
