import { useRouter } from "next/router"
import { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../components/Layout"
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
                setNotification("Incorrect email or password")
              } else {
                setNotification("Failed to authenticate")
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
        >
          <h1>{t("login")}</h1>
          <p>{t("label-email")}</p>
          <input
            type="text"
            name="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
          <p>{t("label-password")}</p>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
          <button name="login">{t("button-text-submit")}</button>
        </form>
        {notification && <p>{notification}</p>}
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
