import { useQuery } from "@tanstack/react-query"

import { userInfo } from "../services/backend/auth"

const useUserInfo = () => {
  const query = useQuery({ queryKey: ["user-info"], queryFn: () => userInfo() })
  return query
}

export default useUserInfo
