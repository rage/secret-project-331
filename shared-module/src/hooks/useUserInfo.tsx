import { useQuery } from "@tanstack/react-query"

import { userInfo } from "../services/backend/auth"

const useUserInfo = () => {
  const query = useQuery(["user-info"], () => userInfo())
  return query
}

export default useUserInfo
