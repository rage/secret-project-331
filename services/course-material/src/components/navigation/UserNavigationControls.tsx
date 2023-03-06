import { ClassNamesArg, cx } from "@emotion/css"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../../shared-module/components/Button"
import OnlyRenderIfPermissions from "../../shared-module/components/OnlyRenderIfPermissions"
import Spinner from "../../shared-module/components/Spinner"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { logout } from "../../shared-module/services/backend/auth"
import { useCurrentPagePathForReturnTo } from "../../shared-module/utils/redirectBackAfterLoginOrSignup"
import { manageCourseRoute } from "../../shared-module/utils/routes"
import SelectCourseInstanceModal from "../modals/SelectCourseInstanceModal"

export interface UserNavigationControlsProps {
  styles?: ClassNamesArg[]
  currentPagePath: string
  courseId?: string | null
}

const UserNavigationControls: React.FC<React.PropsWithChildren<UserNavigationControlsProps>> = ({
  styles,
  currentPagePath,
  courseId,
}) => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const [showSettings, setShowSettings] = useState<boolean>(false)
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
      {showSettings && (
        <SelectCourseInstanceModal
          onClose={() => {
            setShowSettings(false)
          }}
          manualOpen={showSettings}
        />
      )}
      {courseId && (
        <OnlyRenderIfPermissions
          action={{
            type: "teach",
          }}
          resource={{
            type: "course",
            id: courseId,
          }}
        >
          <li>
            <a href={manageCourseRoute(courseId)}>
              <Button variant="primary" size="medium">
                {t("button-text-manage-course")}
              </Button>
            </a>
          </li>
        </OnlyRenderIfPermissions>
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

export default UserNavigationControls
