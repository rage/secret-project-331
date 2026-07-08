/** Health check hit by the k8s startup/liveness/readiness probes at `/{base}/api/status/up`. */
export function handleStatusUp(): Response {
  return Response.json(true)
}
