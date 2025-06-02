import axios from "axios"

import { ActionOnResource, CreateAccountDetails, UserInfo } from "../../bindings"
import { isUserInfo } from "../../bindings.guard"
import { isArray, isBoolean, isNull, isUnion, validateResponse } from "../../utils/fetching"

export const loggedIn = async (): Promise<boolean> => {
  const response = await axios.get(`/api/v0/auth/logged-in`, { responseType: "json" })
  return validateResponse(response, isBoolean)
}

export const createUser = async (newUser: CreateAccountDetails): Promise<void> => {
  await axios.post(`/api/v0/auth/signup`, newUser)
}

export const login = async (email: string, password: string): Promise<boolean> => {
  const response = await axios.post(`/api/v0/auth/login`, {
    email,
    password,
  })
  return validateResponse(response, isBoolean)
}

export const logout = async (): Promise<void> => {
  await axios.post(`/api/v0/auth/logout`)
}

export const authorize = async (action: ActionOnResource): Promise<boolean> => {
  const response = await axios.post("/api/v0/auth/authorize", action)
  return validateResponse(response, isBoolean)
}

export const authorizeMultiple = async (action: ActionOnResource[]): Promise<boolean[]> => {
  const response = await axios.post("/api/v0/auth/authorize-multiple", action)
  return validateResponse(response, isArray(isBoolean))
}

export const userInfo = async (): Promise<UserInfo | null> => {
  const response = await axios.get(`/api/v0/auth/user-info`, { responseType: "json" })
  return validateResponse(response, isUnion(isUserInfo, isNull))
}
