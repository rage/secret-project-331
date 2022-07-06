/* eslint-disable i18next/no-literal-string */
import axios from "axios"

import { ActionOnResource, CreateAccountDetails } from "../../bindings"

export const loggedIn = async (): Promise<boolean> => {
  const url = `/api/v0/auth/logged-in`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const createUser = async (newUser: CreateAccountDetails): Promise<void> => {
  const url = `/api/v0/auth/signup`
  await axios.post(url, newUser)
}

export const login = async (email: string, password: string): Promise<void> => {
  const url = `/api/v0/auth/login`
  await axios.post(url, {
    email,
    password,
  })
}

export const logout = async (): Promise<void> => {
  const url = `/api/v0/auth/logout`
  await axios.post(url)
}

export const authorize = async (action: ActionOnResource): Promise<boolean> => {
  return (await axios.post("/api/v0/auth/authorize", action)).data
}

export const authorizeMultiple = async (action: ActionOnResource[]): Promise<boolean[]> => {
  return (await axios.post("/api/v0/auth/authorize-multiple", action)).data
}
