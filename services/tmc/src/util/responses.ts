// response helpers

export const ok = (
  res: NextApiResponse<ExerciseTaskGradingResult>,
  modelSolutionSpec: ExerciseTaskGradingResult,
): void => {
  res.status(200).json(modelSolutionSpec)
}

export const badRequest = (
  res: NextApiResponse<ClientErrorResponse>,
  contextMessage: string,
  error?: unknown,
): void => {
  errorResponse(res, 400, contextMessage, error)
}

export const internalServerError = (
  res: NextApiResponse<ClientErrorResponse>,
  contextMessage: string,
  err?: unknown,
): void => {
  errorResponse(res, 500, contextMessage, err)
}

export const errorResponse = (
  res: NextApiResponse<ClientErrorResponse>,
  statusCode: number,
  contextMessage: string,
  err?: unknown,
) => {
  let message
  let stack = undefined
  if (err instanceof Error) {
    message = `${contextMessage}: ${err.message}`
    stack = err.stack
  } else if (typeof err === "string") {
    message = `${contextMessage}: ${err}`
  } else if (err === undefined) {
    message = contextMessage
  } else {
    // unexpected type
    message = `${contextMessage}: ${JSON.stringify(err, undefined, 2)}`
  }
  error(message, stack)
  res.status(statusCode).json({ message })
}
