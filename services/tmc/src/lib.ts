import * as k8s from "@kubernetes/client-node"
import axios from "axios"
import * as fs from "fs"

export const initKubeConfig = (): k8s.KubeConfig => {
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()
  return kc
}

export const initKubeApi = (): k8s.CoreV1Api => {
  const k8sApi = initKubeConfig().makeApiClient(k8s.CoreV1Api)
  return k8sApi
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
  await new Promise((resolve, reject) => {
    templateWriter.on("finish", resolve)
    templateWriter.on("error", reject)
  })
}
