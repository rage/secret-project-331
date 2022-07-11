import { css } from "@emotion/css"
import { Alert, FormControl, Input, InputLabel } from "@mui/material"
import Link from "next/link"
import { useRouter } from "next/router"
import { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../components/Layout"
import Button from "../shared-module/components/Button"
import LoginStateContext from "../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../shared-module/hooks/useQueryParameter"
import useToastMutation from "../shared-module/hooks/useToastMutation"
import { login } from "../shared-module/services/backend/auth"
import {
  useCurrentPagePathForReturnTo,
  validateReturnToRouteOrDefault,
} from "../shared-module/utils/redirectBackAfterLoginOrSignup"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"

const Login: React.FC = () => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)

  const router = useRouter()
  const [notification, setNotification] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const uncheckedReturnTo = useQueryParameter("return_to")
  const returnToForLinkToSignupPage = useCurrentPagePathForReturnTo(router.asPath)

  const loginMutation = useToastMutation(
    async () => {
      await login(email, password)
    },
    { notify: false },
  )

  const EMAIL = "email"
  const PASSWORD = "password"
  const LOGIN = "login"

  return (
    <Layout>
      <div
        className={css`
          margin: 0 auto;
          a {
            text-decoration: none;
            color: #007bff;
            :hover {
              text-decoration: underline;
            }
          }
        `}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            try {
              await loginMutation.mutateAsync()
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
            const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
            router.push(returnTo)
          }}
          className={css`
            display: flex;
            flex-direction: column;
            padding: 3rem 0rem;
          `}
        >
          <h1>{t("login")}</h1>
          <div
            className={css`
              margin-bottom: 2rem;
            `}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            {t("login-description")} <a href="https://mooc.fi">mooc.fi</a> {t("login-description2")}
          </div>
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
              margin: 2rem 0rem;
            `}
            name={LOGIN}
            variant={"primary"}
            size={"medium"}
            id={"login-button"}
            disabled={
              !email || !password || email === "" || password === "" || loginMutation.isLoading
            }
          >
            {t("login")}
          </Button>
          <div
            className={css`
              margin-bottom: 1.5rem;
              display: none;
            `}
          >
            <Link href="/sign-up">{t("create-new-account")}</Link>
          </div>
          <div
            className={css`
              margin-bottom: 1.5rem;
            `}
          >
            <a href="https://tmc.mooc.fi/password_reset_keys/new">{t("forgot-password")}</a>
          </div>
          <div
            className={css`
              margin-bottom: 1.5rem;
            `}
          >
            <a href={`/signup?return_to=${encodeURIComponent(returnToForLinkToSignupPage)}`}>
              {t("create-an-acount")}
            </a>
          </div>
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
