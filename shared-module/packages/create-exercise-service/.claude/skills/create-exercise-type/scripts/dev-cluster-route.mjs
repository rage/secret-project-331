#!/usr/bin/env node
// Prints the manifests that route project-331.local/<slug> in the local minikube cluster to a
// plugin dev server running on the host. Pipe to `kubectl apply -f -`; `kubectl delete -f -` undoes it.
//
// The backend pod must reach the host, which `kubectl port-forward` cannot do (it only forwards the
// other way), so a selector-less Service is backed by an EndpointSlice holding the host's address.

const DEFAULT_HOST_IP = "192.168.49.1" // host.minikube.internal with the docker driver

function usage() {
  return `Usage: node dev-cluster-route.mjs <slug> <port> [--host-ip <ip>]

  slug       the plugin's slug; also its base path, Service name and ingress path
  port       the dev server's port on the host
  --host-ip  the host as seen from minikube (default ${DEFAULT_HOST_IP}; check with
             \`minikube ssh -- getent hosts host.minikube.internal\`)`
}

function fail(message) {
  console.error(`${message}\n\n${usage()}`)
  process.exit(2)
}

/**
 * Builds the Service, EndpointSlice and Ingress for one host-run plugin dev server.
 *
 * @param {{ slug: string, port: number, hostIp: string }} route slug must be a DNS label; the dev
 *   server must run with `PUBLIC_BASE_PATH=/<slug>` and listen on `0.0.0.0:<port>`
 * @returns {string} multi-document YAML
 */
export function devClusterRouteManifest({ slug, port, hostIp }) {
  return `apiVersion: v1
kind: Service
metadata:
  name: ${slug}
spec:
  ports:
    - port: ${port}
      targetPort: ${port}
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: ${slug}-host
  labels:
    kubernetes.io/service-name: ${slug}
addressType: IPv4
ports:
  - port: ${port}
endpoints:
  - addresses: ["${hostIp}"]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${slug}-dev
spec:
  ingressClassName: nginx
  rules:
    - host: project-331.local
      http:
        paths:
          - path: /${slug}
            pathType: Prefix
            backend:
              service:
                name: ${slug}
                port:
                  number: ${port}
`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  if (args.includes("-h") || args.includes("--help")) {
    console.log(usage())
    process.exit(0)
  }
  let hostIp = DEFAULT_HOST_IP
  const hostIpIndex = args.indexOf("--host-ip")
  if (hostIpIndex !== -1) {
    if (args[hostIpIndex + 1] === undefined) {
      fail("--host-ip needs a value")
    }
    hostIp = args[hostIpIndex + 1]
    args.splice(hostIpIndex, 2)
  }
  const [slug, portArg, ...extra] = args
  if (!slug || !portArg || extra.length > 0) {
    fail("Expected exactly <slug> and <port>.")
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
    fail(`Slug ${JSON.stringify(slug)} is not a DNS label.`)
  }
  const port = Number(portArg)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`Port ${JSON.stringify(portArg)} is not a TCP port.`)
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostIp)) {
    fail(`Host IP ${JSON.stringify(hostIp)} is not an IPv4 address.`)
  }
  process.stdout.write(devClusterRouteManifest({ slug, port, hostIp }))
}
