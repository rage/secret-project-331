import { mainFrontendClient } from "../mainFrontendClient"

import {
  GroupAccessRow,
  GroupDetailResponse,
  GroupListResponse,
  GroupMember,
  GroupRoleAssignment,
  RoleDomain,
  RoleQuery,
  UserRole,
} from "@/shared-module/common/bindings"

export const fetchOrganizationGroups = async (
  organizationId: string,
): Promise<GroupListResponse> => {
  const response = await mainFrontendClient.get("/groups", {
    params: { organization_id: organizationId },
  })
  return response.data as GroupListResponse
}

export const createOrganizationGroup = async (
  organizationId: string,
  name: string,
): Promise<GroupDetailResponse["group"]> => {
  const response = await mainFrontendClient.post("/groups", {
    organization_id: organizationId,
    name,
  })
  return response.data as GroupDetailResponse["group"]
}

export const fetchGroup = async (groupId: string): Promise<GroupDetailResponse> => {
  const response = await mainFrontendClient.get(`/groups/${groupId}`)
  return response.data as GroupDetailResponse
}

export const renameGroup = async (
  groupId: string,
  name: string,
): Promise<GroupDetailResponse["group"]> => {
  const response = await mainFrontendClient.patch(`/groups/${groupId}`, { name })
  return response.data as GroupDetailResponse["group"]
}

export const deleteGroup = async (groupId: string): Promise<void> => {
  await mainFrontendClient.delete(`/groups/${groupId}`)
}

export const fetchGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
  const response = await mainFrontendClient.get(`/groups/${groupId}/members`)
  return response.data as GroupMember[]
}

export const addGroupMember = async (groupId: string, email: string): Promise<void> => {
  await mainFrontendClient.post(`/groups/${groupId}/members`, { email })
}

export const removeGroupMember = async (groupId: string, userId: string): Promise<void> => {
  await mainFrontendClient.delete(`/groups/${groupId}/members/${userId}`)
}

export const fetchGroupRoles = async (groupId: string): Promise<GroupRoleAssignment[]> => {
  const response = await mainFrontendClient.get(`/groups/${groupId}/roles`)
  return response.data as GroupRoleAssignment[]
}

const buildGroupRolePayload = (role: UserRole, domain: RoleDomain) => ({ role, domain })

export const addGroupRole = async (
  groupId: string,
  role: UserRole,
  domain: RoleDomain,
): Promise<void> => {
  await mainFrontendClient.post(`/groups/${groupId}/roles/add`, buildGroupRolePayload(role, domain))
}

export const removeGroupRole = async (
  groupId: string,
  role: UserRole,
  domain: RoleDomain,
): Promise<void> => {
  await mainFrontendClient.post(
    `/groups/${groupId}/roles/remove`,
    buildGroupRolePayload(role, domain),
  )
}

export const fetchGroupsWithAccessForDomain = async (
  query: RoleQuery,
): Promise<GroupAccessRow[]> => {
  const response = await mainFrontendClient.get(`/groups/domain-access`, { params: query })
  return response.data as GroupAccessRow[]
}
