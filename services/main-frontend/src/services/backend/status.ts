import { healthzClient } from "../healthzClient"
import { mainFrontendClient } from "../mainFrontendClient"

import {
  CronJobInfo,
  DeploymentInfo,
  EventInfo,
  IngressInfo,
  JobInfo,
  PodInfo,
  ServiceInfo,
} from "@/shared-module/common/bindings"
import {
  isCronJobInfo,
  isDeploymentInfo,
  isEventInfo,
  isIngressInfo,
  isJobInfo,
  isPodInfo,
  isServiceInfo,
} from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchPods = async (): Promise<PodInfo[]> => {
  const response = await mainFrontendClient.get("/status/pods")
  return validateResponse(response, isArray(isPodInfo))
}

export const fetchDeployments = async (): Promise<DeploymentInfo[]> => {
  const response = await mainFrontendClient.get("/status/deployments")
  return validateResponse(response, isArray(isDeploymentInfo))
}

export const fetchCronJobs = async (): Promise<CronJobInfo[]> => {
  const response = await mainFrontendClient.get("/status/cronjobs")
  return validateResponse(response, isArray(isCronJobInfo))
}

export const fetchJobs = async (): Promise<JobInfo[]> => {
  const response = await mainFrontendClient.get("/status/jobs")
  return validateResponse(response, isArray(isJobInfo))
}

export const fetchServices = async (): Promise<ServiceInfo[]> => {
  const response = await mainFrontendClient.get("/status/services")
  return validateResponse(response, isArray(isServiceInfo))
}

export const fetchEvents = async (): Promise<EventInfo[]> => {
  const response = await mainFrontendClient.get("/status/events")
  return validateResponse(response, isArray(isEventInfo))
}

export const fetchIngresses = async (): Promise<IngressInfo[]> => {
  const response = await mainFrontendClient.get("/status/ingresses")
  return validateResponse(response, isArray(isIngressInfo))
}

export const fetchPodLogs = async (
  podName: string,
  container?: string,
  tail?: number,
): Promise<string> => {
  const params = new URLSearchParams()
  if (container) {
    params.append("container", container)
  }
  if (tail !== undefined) {
    params.append("tail", tail.toString())
  }

  const response = await mainFrontendClient.get(
    `/status/pods/${podName}/logs${params.toString() ? `?${params.toString()}` : ""}`,
    {
      responseType: "text",
    },
  )
  return response.data
}

export const fetchSystemHealth = async (): Promise<boolean> => {
  const response = await healthzClient.get<boolean>("/system")
  return response.data
}
