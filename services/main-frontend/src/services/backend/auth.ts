import axios from "axios"

export const loggedIn = async (): Promise<boolean> => {
  const url = `/api/v0/auth/logged-in`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const login = async (login: string, password: string): Promise<void> => {
  const url = `/api/v0/auth/login`
  const params = new URLSearchParams()
  params.append("login", login)
  params.append("password", password)

  try {
    await axios.post(url, params)
  } catch (e) {
    console.log("failed to login: ", e)
  }
}

export const logout = async (): Promise<void> => {
  const url = `/api/v0/auth/logout`
  await axios.post(url)
}
