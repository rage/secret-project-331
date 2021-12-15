import { css } from "@emotion/css"
import { Alert, FormControl, Input, InputLabel } from "@material-ui/core"
import { useRouter } from "next/router"
import { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../components/Layout"
import Button from "../shared-module/components/Button"
import LoginStateContext from "../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../shared-module/hooks/useQueryParameter"
import { login } from "../shared-module/services/backend/auth"
import { wideWidthCenteredComponentStyles } from "../shared-module/styles/componentStyles"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"

const Login: React.FC = () => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)

  const router = useRouter()
  const [notification, setNotification] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const uncheckedReturnTo = useQueryParameter("return_to")

  const EMAIL = "email"
  const PASSWORD = "password"
  const LOGIN = "login"

  return (
    <Layout>
      <div className={wideWidthCenteredComponentStyles}>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            try {
              await login(email, password).then((result) => {
                console.log(result)
              })
            } catch (e) {
              if (!(e instanceof Error)) {
                throw e
              }
              console.log("failed to login: ", e)
              // @ts-ignore: null checked
              if (e?.response?.status === 401) {
                setNotification(t("incorrect-email-or-password"))
              } else {
                setNotification(t("failed-to-authenticate"))
              }
              setTimeout(() => {
                setNotification(null)
              }, 3000)
              return null
            }

            await loginStateContext.refresh()
            const returnTo = validateRouteOrDefault(uncheckedReturnTo, "/")
            router.push(returnTo)
          }}
          className={css`
            display: flex;
            flex-direction: column;
            width: 30rem;
            padding: 1rem;
          `}
        >
          <h1>{t("login")}</h1>
          <FormControl
            className={css`
              margin-top: 1rem;
            `}
          >
            <InputLabel htmlFor={EMAIL}>{t("label-email")}</InputLabel>
            <Input
              id={EMAIL}
              type="text"
              name={EMAIL}
              required={true}
              value={email}
              aria-required={true}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </FormControl>
          <FormControl
            className={css`
              margin-top: 1rem;
            `}
          >
            <InputLabel htmlFor={PASSWORD}>{t("label-password")}</InputLabel>
            <Input
              id={PASSWORD}
              type="password"
              name={PASSWORD}
              required={true}
              value={password}
              aria-required={true}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </FormControl>
          <Button
            className={css`
              margin-top: 2rem;
            `}
            name={LOGIN}
            variant={"primary"}
            size={"medium"}
          >
            {t("login")}
          </Button>
          {notification && (
            <Alert
              className={css`
                margin-top: 1rem;
              `}
              severity="error"
            >
              {notification}
            </Alert>
          )}
        </form>
      </div>
    </Layout>
  )
}

export default withErrorBoundary(Login)

function validateRouteOrDefault(returnPath: string | undefined, defaultPath: string): string {
  if (!returnPath) {
    return defaultPath
  }

  // Only match paths like /asd, /asd/dfg, ...
  const match = returnPath.match(/^(\/\S+)+/)
  if (match === null) {
    return defaultPath
  }

  // Don't allow "returning" to login page
  if (returnPath === "/login") {
    return defaultPath
  }

  return returnPath
}
