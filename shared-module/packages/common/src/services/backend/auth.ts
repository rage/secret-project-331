import { ActionOnResource, CreateAccountDetails, LoginResponse, UserInfo } from "../../authApiTypes"
import {
  getAuthLoggedIn,
  getAuthUserInfo,
  postAuthAuthorize,
  postAuthAuthorizeMultiple,
  postAuthDeleteUserAccount,
  postAuthLogin,
  postAuthLogout,
  postAuthSendEmailCode,
  postAuthSignup,
  postAuthVerifyEmail,
} from "../../generated/auth-api/sdk.generated"
import "../../init/registerAuthApiClients"

export const loggedIn = async (): Promise<boolean> => {
  return getAuthLoggedIn()
}

export const createUser = async (newUser: CreateAccountDetails): Promise<void> => {
  await postAuthSignup({ body: newUser })
}

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  return postAuthLogin({
    body: { email, password },
  })
}

export const verifyEmail = async (
  email_verification_token: string,
  code: string,
): Promise<boolean> => {
  return postAuthVerifyEmail({
    body: { email_verification_token, code },
  })
}

export const logout = async (): Promise<void> => {
  await postAuthLogout()
}

export const authorize = async (action: ActionOnResource): Promise<boolean> => {
  return postAuthAuthorize({ body: action })
}

export const authorizeMultiple = async (action: ActionOnResource[]): Promise<boolean[]> => {
  return postAuthAuthorizeMultiple({ body: action })
}

export const userInfo = async (): Promise<UserInfo | null> => {
  const response = await getAuthUserInfo()
  if (response === null) {
    return null
  }
  return {
    user_id: response.user_id,
    first_name: response.first_name ?? null,
    last_name: response.last_name ?? null,
  }
}

export const sendEmailCode = async (
  email: string,
  password: string,
  language: string,
): Promise<boolean> => {
  return postAuthSendEmailCode({
    body: { email, password, language },
  })
}

export const deleteUserAccount = async (code: string): Promise<boolean> => {
  return postAuthDeleteUserAccount({
    body: { code },
  })
}
