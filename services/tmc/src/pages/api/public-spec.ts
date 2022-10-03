/* eslint-disable i18next/no-literal-string */
import axios from "axios"
import { promises as fs } from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import { temporaryDirectory, temporaryFile } from "tempy"

import { ClientErrorResponse } from "../../lib"
import { RepositoryExercise } from "../../shared-module/bindings"
import { isRepositoryExercise } from "../../shared-module/bindings.guard"
import { isString } from "../../shared-module/utils/fetching"
import { compressProject, extractProject, prepareStub } from "../../tmc/langs"

export default async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  return await handlePost(req, res)
}

type PublicSpecRequest = RepositoryExercise & { upload_url: string }

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse<void | ClientErrorResponse>,
): Promise<void> {
  let request: PublicSpecRequest
  const upload_url = req.body["upload_url"]
  if (isRepositoryExercise(req.body) && isString(upload_url)) {
    request = { ...req.body, upload_url }
  } else {
    throw `Invalid public spec request body: ${JSON.stringify(req.body, null, 2)}`
  }

  try {
    console.debug("downloading template")
    const templateArchive = temporaryFile()
    const templateRes = await axios({
      url: request.download_url,
      method: "GET",
      responseType: "blob",
    })
    await fs.writeFile(templateArchive, templateRes.data)

    console.debug("extracting template")
    const templateDir = temporaryDirectory()
    await extractProject(templateArchive, templateDir)

    console.debug("preparing stub")
    const stubDir = temporaryDirectory()
    await prepareStub(templateDir, stubDir)

    console.debug("compressing solution")
    const stubArchive = temporaryFile()
    await compressProject(stubDir, stubArchive)

    console.debug("uploading stub")
    await axios.post(request.upload_url, { file: stubArchive })

    return res.status(200).send()
  } catch (e) {
    if (e instanceof Error) {
      console.log(e.stack)
    }
    return res.status(500).json({ message: `Internal server error: ${e}` })
  }
}
