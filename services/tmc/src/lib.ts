import * as k8s from "@kubernetes/client-node"
import axios from "axios"
import * as fs from "fs"

export function initKube(): { config: k8s.KubeConfig; api: k8s.CoreV1Api } {
  const config = new k8s.KubeConfig()
  config.loadFromDefault()
  const api = config.makeApiClient(k8s.CoreV1Api)
  return { config, api }
}

export interface ClientErrorResponse {
  message: string
}

export interface ExerciseFeedback {
  stdout: string
  stderr: string
}

export const downloadStream = async (url: string, target: string) => {
  console.debug("downloading", url, "to", target)
  const templateRes = await axios({
    url,
    method: "GET",
    responseType: "stream",
  })
  const templateWriter = fs.createWriteStream(target)
  templateRes.data.pipe(templateWriter)
  await new Promise<void>((resolve, reject) => {
    templateWriter.on("finish", resolve)
    templateWriter.on("error", reject)
  })
}
