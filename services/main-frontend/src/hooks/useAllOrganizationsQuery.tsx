import { useQuery } from "@tanstack/react-query"

import { fetchOrganizations } from "../services/backend/organizations"

const useAllOrganizationsQuery = () => {
  return useQuery({
    queryKey: [`organizations`],
    queryFn: () => fetchOrganizations(),
    gcTime: 60000,
  })
}

export default useAllOrganizationsQuery
