import { queryOptions } from "@tanstack/react-query"

import {
  getStatusCronjobsOptions as getStatusCronjobsGeneratedOptions,
  getStatusDeploymentsOptions as getStatusDeploymentsGeneratedOptions,
  getStatusEventsOptions as getStatusEventsGeneratedOptions,
  getStatusHealthOptions as getStatusHealthGeneratedOptions,
  getStatusIngressesOptions as getStatusIngressesGeneratedOptions,
  getStatusJobsOptions as getStatusJobsGeneratedOptions,
  getStatusPodDisruptionBudgetsOptions as getStatusPodDisruptionBudgetsGeneratedOptions,
  getStatusPodLogsOptions as getStatusPodLogsGeneratedOptions,
  getStatusPodsOptions as getStatusPodsGeneratedOptions,
  getStatusServicesOptions as getStatusServicesGeneratedOptions,
  getStatusSystemHealthOptions as getStatusSystemHealthGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  getStatusCronjobs as getStatusCronjobsFromApi,
  getStatusDeployments as getStatusDeploymentsFromApi,
  getStatusEvents as getStatusEventsFromApi,
  getStatusHealth as getStatusHealthFromApi,
  getStatusIngresses as getStatusIngressesFromApi,
  getStatusJobs as getStatusJobsFromApi,
  getStatusPodDisruptionBudgets as getStatusPodDisruptionBudgetsFromApi,
  getStatusPodLogs as getStatusPodLogsFromApi,
  getStatusPods as getStatusPodsFromApi,
  getStatusServices as getStatusServicesFromApi,
  getStatusSystemHealth as getStatusSystemHealthFromApi,
} from "@/generated/api/sdk.generated"
import {
  CronJobInfo,
  DeploymentInfo,
  EventInfo,
  IngressInfo,
  JobInfo,
  PodDisruptionBudgetInfo,
  PodInfo,
  ServiceInfo,
  SystemHealthStatus,
} from "@/shared-module/common/bindings"
import {
  isCronJobInfo,
  isDeploymentInfo,
  isEventInfo,
  isIngressInfo,
  isJobInfo,
  isPodDisruptionBudgetInfo,
  isPodInfo,
  isServiceInfo,
  isSystemHealthStatus,
} from "@/shared-module/common/bindings.guard"
import { isArray, isString } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const fetchPods = async (): Promise<PodInfo[]> => {
  const data = await getStatusPodsFromApi({ throwOnError: true })
  return validateGeneratedData(data, isArray(isPodInfo))
}

export const getStatusPodsOptions = () =>
  queryOptions({
    ...getStatusPodsGeneratedOptions(),
    select: (data): PodInfo[] => validateGeneratedData(data, isArray(isPodInfo)),
  })

export const fetchDeployments = async (): Promise<DeploymentInfo[]> => {
  const data = await getStatusDeploymentsFromApi({ throwOnError: true })
  return validateGeneratedData(data, isArray(isDeploymentInfo))
}

export const getStatusDeploymentsOptions = () =>
  queryOptions({
    ...getStatusDeploymentsGeneratedOptions(),
    select: (data): DeploymentInfo[] => validateGeneratedData(data, isArray(isDeploymentInfo)),
  })

export const fetchCronJobs = async (): Promise<CronJobInfo[]> => {
  const data = await getStatusCronjobsFromApi({ throwOnError: true })
  return validateGeneratedData(data, isArray(isCronJobInfo))
}

export const getStatusCronJobsOptions = () =>
  queryOptions({
    ...getStatusCronjobsGeneratedOptions(),
    select: (data): CronJobInfo[] => validateGeneratedData(data, isArray(isCronJobInfo)),
  })

export const fetchJobs = async (): Promise<JobInfo[]> => {
  const data = await getStatusJobsFromApi({ throwOnError: true })
  return validateGeneratedData(data, isArray(isJobInfo))
}

export const getStatusJobsOptions = () =>
  queryOptions({
    ...getStatusJobsGeneratedOptions(),
    select: (data): JobInfo[] => validateGeneratedData(data, isArray(isJobInfo)),
  })

export const fetchServices = async (): Promise<ServiceInfo[]> => {
  const data = await getStatusServicesFromApi({ throwOnError: true })
  return validateGeneratedData(data, isArray(isServiceInfo))
}

export const getStatusServicesOptions = () =>
  queryOptions({
    ...getStatusServicesGeneratedOptions(),
    select: (data): ServiceInfo[] => validateGeneratedData(data, isArray(isServiceInfo)),
  })

export const fetchEvents = async (): Promise<EventInfo[]> => {
  const data = await getStatusEventsFromApi({ throwOnError: true })
  return validateGeneratedData(data, isArray(isEventInfo))
}

export const getStatusEventsOptions = () =>
  queryOptions({
    ...getStatusEventsGeneratedOptions(),
    select: (data): EventInfo[] => validateGeneratedData(data, isArray(isEventInfo)),
  })

export const fetchIngresses = async (): Promise<IngressInfo[]> => {
  const data = await getStatusIngressesFromApi({ throwOnError: true })
  return validateGeneratedData(data, isArray(isIngressInfo))
}

export const getStatusIngressesOptions = () =>
  queryOptions({
    ...getStatusIngressesGeneratedOptions(),
    select: (data): IngressInfo[] => validateGeneratedData(data, isArray(isIngressInfo)),
  })

export const fetchPodDisruptionBudgets = async (): Promise<PodDisruptionBudgetInfo[]> => {
  const data = await getStatusPodDisruptionBudgetsFromApi({ throwOnError: true })
  return validateGeneratedData(data, isArray(isPodDisruptionBudgetInfo))
}

export const getStatusPodDisruptionBudgetsOptions = () =>
  queryOptions({
    ...getStatusPodDisruptionBudgetsGeneratedOptions(),
    select: (data): PodDisruptionBudgetInfo[] =>
      validateGeneratedData(data, isArray(isPodDisruptionBudgetInfo)),
  })

export const fetchPodLogs = async (
  podName: string,
  container?: string,
  tail?: number,
): Promise<string> => {
  const data = await getStatusPodLogsFromApi({
    path: {
      pod_name: podName,
    },
    query: {
      container,
      tail,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isString)
}

export const getStatusPodLogsOptions = (podName: string, container?: string, tail?: number) =>
  queryOptions({
    ...getStatusPodLogsGeneratedOptions({
      path: {
        pod_name: podName,
      },
      query: {
        container,
        tail,
      },
    }),
    select: (data): string => validateGeneratedData(data, isString),
  })

export const fetchSystemHealth = async (): Promise<boolean> => {
  return getStatusSystemHealthFromApi({ throwOnError: true })
}

export const getStatusSystemHealthOptions = () => getStatusSystemHealthGeneratedOptions()

export const fetchSystemHealthDetailed = async (): Promise<SystemHealthStatus> => {
  const data = await getStatusHealthFromApi({ throwOnError: true })
  return validateGeneratedData(data, isSystemHealthStatus)
}

export const getStatusHealthOptions = () =>
  queryOptions({
    ...getStatusHealthGeneratedOptions(),
    select: (data): SystemHealthStatus => validateGeneratedData(data, isSystemHealthStatus),
  })
