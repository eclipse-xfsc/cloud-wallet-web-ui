# Cloud Web UI — ListenerSet chart 0.5.1

This version retains the supplied chart's `global.domain`, `global.tenantId`, hostname prefix `wallet`, image defaults and issuer `letsencrypt`. It no longer creates a Gateway under any configuration.

## Minimal wrapper values

```yaml
global:
  domain: example.org
  tenantId: firma-a

wallet: # replace with your dependency alias
  gateway:
    name: envoy-gateway
    namespace: infrastructure
```

The chart always creates a ListenerSet. Its parent is the existing Gateway named above; that Gateway is never managed or modified by this chart. The generated hostname is **wallet.firma-a.example.org**. The HTTPRoute references the ListenerSet in the release namespace. The Certificate and TLS Secret are also in the release namespace.

Standalone example: `values-listenerset.example.yaml`. Wrapper example: `values-wrapper.example.yaml`. Use a built Cloud Web UI image under `frontendContainer.image` / `tag`; this chart does not build the frontend or deploy its backend.

## Central Gateway requirements

Requires stable Gateway API v1 ListenerSet CRDs (Gateway API 1.5+) and an Envoy Gateway controller that supports them. The infrastructure team must permit tenant ListenerSets through the existing Gateway's `spec.allowedListeners`, for example this fragment merged into its existing spec:

```yaml
spec:
  allowedListeners:
    namespaces:
      from: Selector
      selector:
        matchLabels:
          kubernetes.io/metadata.name: firma-a
```

The ListenerSet itself defaults to `allowedRoutes.namespaces.from: Same`, so the frontend HTTPRoute must be in the same namespace as the ListenerSet. A `Selector` rule needs a complete `listenerSet.allowedRoutes.namespaces.selector`.

## TLS and HTTP

`certificate.enabled=true` uses the existing cert-manager ClusterIssuer `letsencrypt` by default. The issuer and cert-manager must already exist and have a working solver. If disabled, set `certificate.secretName` to an existing TLS Secret in the release namespace. The central Gateway's certificate is not automatically inherited.

Only HTTPS is created by default. `listenerSet.http.enabled=true` adds a tenant HTTP listener and HTTP-to-HTTPS redirect route. Otherwise manage HTTP centrally. An ACME HTTP-01 solver needs an independently configured, reachable HTTP listener and permitted solver route attachment. This chart does not configure the issuer's solver or DNS. DNS-01 does not need an HTTP listener.

## Other values retained

- `global.domain` and `global.tenantId` are the only domain/tenant inputs. Wrapper globals belong at the wrapper root.
- Keycloak defaults to `https://auth.<global.domain>`, realm `<global.tenantId>`, client `wallet-web`; override via `keycloak` when necessary.
- API addresses are derived from the generated wallet hostname and passed as runtime WALLET_* variables.
- `api.backendName` optionally routes `/api` unchanged to an existing API gateway service in the release namespace. No API backend is installed by the chart.
- Deployment and Service selectors remain scoped by Helm release.
- The ListenerSet and HTTPS HTTPRoute are always created. There is no `listenerSet.enabled` switch.

## Migration from 0.4.x / 0.5.0

Remove `gateway.create`, `gateway.className`, `gateway.sectionName`, `gateway.httpSectionName` `listenerSet.parentRef` and `listenerSet.enabled` from your values. The single parent reference is now `gateway.name` / `gateway.namespace`. Removed fields are rejected by the values schema instead of being silently ignored. Update the wrapper dependency version to 0.5.1 and its lock/package as applicable.

If an older release actually owned a Gateway, upgrading removes that old chart resource. Keep the central infrastructure Gateway independently managed before that upgrade. A Gateway managed outside the release is unaffected. No cluster installation was performed during this change.

## Checks

```sh
helm lint .
helm template wallet-a . --namespace firma-a --set global.domain=example.org --set global.tenantId=firma-a
kubectl describe listenerset wallet-a-web-ui-listeners -n firma-a
kubectl describe httproute wallet-a-web-ui -n firma-a
```

Check Accepted/Programmed and listener/route conditions on the real cluster after deployment. Installing CRDs alone is not proof of controller support.
