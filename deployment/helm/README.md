# Tenant wallet with Envoy Gateway

## Minimal installation

```sh
helm upgrade --install wallet-a ./deployment/helm \
  --namespace tenant-a --create-namespace \
  --set domain=example.org --set tenantId=firma-a --wait
```

Generated configuration:

| Item | Value |
| --- | --- |
| Wallet, Gateway listeners, HTTPRoute and Certificate DNS name | firma-a.example.org |
| API base | https://firma-a.example.org/api |
| Account service base | https://firma-a.example.org/api/accounts |
| Keycloak auth base | https://auth.example.org |
| Keycloak realm | firma-a |
| Fixed client ID | wallet-web |

`domain` is the root DNS domain without a scheme, path or trailing dot. `tenantId` is a lowercase DNS label. DNS for the generated hostname must point to the Envoy Gateway address. The Keycloak hostname must point to the existing authentication installation; this chart does not deploy Keycloak or issue its certificate.

Gateway API v1 CRDs, Envoy Gateway, its GatewayClass (default `eg`), cert-manager and the configured issuer (default ClusterIssuer `letsencrypt-prod`) must already exist. Change `gateway.className` and `certificate.issuerRef` to match your cluster. The issuer must have a functional DNS-01 or Gateway HTTP-01 solver. An ingress-based HTTP-01 solver is not provided by this chart. No cluster-wide GatewayClass or issuer is installed.

The chart creates a per-release Gateway in the release namespace, an HTTPS HTTPRoute, an HTTP-to-HTTPS redirect HTTPRoute, and an explicit cert-manager Certificate. The Gateway HTTPS listener references the generated TLS Secret. Hostnames are derived once from `tenantId.domain`; no route URLs are repeated in values. Existing nginx Ingress/basic-auth annotations are removed; application authentication is Keycloak.

## Backend routing

The chart deploys the frontend only. If an existing API gateway service in the same namespace handles `/api`, pass its Kubernetes service name once:

```sh
--set api.backendName=my-api-gateway --set api.backendPort=8080
```

The `/api` prefix is preserved and has precedence over the frontend `/` route. The API gateway must already handle `/api/accounts` and other API paths. When `api.backendName` is empty, this chart creates no API-specific backend rule: configure your backend's more specific HTTPRoute on the same Gateway, or supply the API gateway service above. Do not expect wallet operations to work without a backend route.

## Shared existing Gateway

```yaml
gateway:
  create: false
  name: shared
  namespace: envoy-gateway-system
  sectionName: https
  httpSectionName: http
```

The referenced Gateway must have those listeners, cover the derived hostname and allow HTTPRoutes from the wallet namespace. The chart creates its Certificate/Secret in the Gateway namespace. The operator must attach that Secret to the existing HTTPS listener (or provide a listener whose existing certificate already covers the hostname). Creating a Certificate alone does not attach it to an existing Gateway. Helm needs write permission to the certificate namespace. For an existing wildcard certificate use `certificate.enabled=false` and configure the existing listener accordingly. Default managed Gateways need none of these manual listener steps.

## Runtime configuration

Auth and public API settings are provided as container environment variables at startup. The server includes public configuration in the initial page, so the same image can run under different domains without rebuilding. No preliminary `/api/keycloak-config` request is used by the UI. Local development uses `.env.local.example` as a template. Override Keycloak via `keycloak.authUrl`, `keycloak.realm`, `keycloak.clientId` if your naming differs; additional `env` values cannot override generated keys.

## Upgrade from the Ingress chart

The previous Ingress is removed. Service and pod selectors now include the Helm release to isolate multiple installations. The new deployment name ends in `-deployment-v2` to avoid changing an existing Deployment's immutable selector. Helm replaces the old Deployment with this new resource. Prepare DNS, GatewayClass and issuer before upgrading and plan for an interruption during the ingress-to-gateway transition. This chart has not been applied to your cluster.

## Local checks

```sh
helm lint deployment/helm --set domain=example.org --set tenantId=firma-a
helm template wallet-a deployment/helm --set domain=example.org --set tenantId=firma-a
```
