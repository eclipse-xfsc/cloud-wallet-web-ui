# Mini-Backend und Wallet-Demo

## Start: ein Befehl

Im Projektordner nach `npm ci`:

```sh
npm run demo
```

Dann http://localhost:3000/de öffnen und „Anmelden“ anklicken oder direkt http://localhost:3000/de/demo/login öffnen.

**Benutzername: demo – Passwort: demo**

Die Demo wird nur mit `MOCK_MODE=true` aktiviert. `npm run demo` setzt diese Variable selbst. Ohne Demo-Modus bleiben Keycloak und die bestehende Wallet aktiv; Demo-Seiten und -API antworten mit 404.

Das Backend läuft im Demo-Modus direkt als Next.js-API. Keycloak, Datenbank und externe Backend-Dienste sind nicht erforderlich. Der Startbefehl öffnet zusätzlich automatisch den separaten Drittwebsite-Demoprozess auf Port 4101; Ctrl+C beendet beide Prozesse. Wer nur die API separat benötigt, startet `npm run mock:backend` auf http://127.0.0.1:4100. Dieser Server lauscht standardmäßig ausschließlich auf Loopback. Port/Host sind mit MOCK_PORT/MOCK_HOST einstellbar. Für per Telefon gescannte QR-Codes müssen Frontend und Browser dieselbe erreichbare Adresse verwenden; ein localhost-Link auf dem Telefon zeigt auf das Telefon selbst.

Für einen lokalen Produktionsbuild: `MOCK_MODE=true npm run build`, anschließend `MOCK_MODE=true npm start`. Vor einem normalen Produktionsbuild `MOCK_MODE` deaktivieren.

## Seiten und Durchlauf

- `/de/demo/login`: JWT-Anmeldung, demo / demo.
- `/de/demo`: Startseite und gerenderte SD-JWT-/LDP-VC-Karten mit Rohdaten.
- `/de/demo/offer`: Angebotsliste.
- `/de/demo/offer/welcome`: vorgefülltes Angebot prüfen, annehmen oder ablehnen. Die Seite zeigt nach der Annahme die Empfangsquittung.
- `/de/demo/presentation`: Präsentationsanfragen.
- `/de/demo/presentation/employment`: passenden Nachweis wählen, konkrete Angaben prüfen und ausdrücklich freigeben. Danach erscheint die Sendequittung.
- `/de/demo/history`: Ereignisse `credential_received` und `presentation_sent`, mit Filter.
- Sprachwahl direkt im Header von Startseite, Login und Wallet; alte `/de/demo/settings`-Links führen zur Wallet zurück. Der JWT-Testbutton ist entfernt; die API verifiziert weiterhin jeden geschützten Aufruf.
- `/de/demo/links`: neue SD-JWT-/LDP-Angebote und OID4VP-Anfragen erzeugen. HTTP-Redirect, Direktlink und QR-Code führen zur jeweiligen Prüfseite. Custom-Scheme-Links können kopiert und im Importfeld geöffnet werden. Der eigene Importbereich /de/demo/import unterstützt außerdem QR-Bild-URLs, Upload und Zwischenablagebilder.

Englische Navigation über `/en/demo`. Deep Links sind illustrative `openid4vp://authorize?request_uri=...` bzw. `openid-credential-offer://?credential_offer_uri=...` URLs. Der lokale Import löst ausschließlich eigene Demo-Request-URIs auf, keine fremden URLs. Es wird kein nativer Betriebssystem-Protokollhandler installiert. Bei unangemeldetem Öffnen eines HTTP-Redirects wird das Ziel durch die Anmeldung erhalten.

## API

Integriert: `/api/mock` voranstellen. Im Demo-Dev-Server sind zusätzlich die kanonischen `/api/...` Adressen per Rewrite erreichbar. Separater Server: direkt `/api/...` nutzen.

| Methode | Pfad | Funktion |
| --- | --- | --- |
| GET | `/api/configuration` | öffentliche Demo-Konfiguration |
| POST | `/api/auth/login` | `{username:"demo", password:"demo"}` → access_token |
| GET | `/api/auth/verify` | JWT-Verifikation |
| POST | `/api/auth/logout` | `{}` → Sitzung widerrufen |
| GET | `/api/configuration/user` | Benutzereinstellungen |
| PUT | `/api/configuration/language` | `{language:"de"}` oder `en` |
| POST | `/api/credentials` | vier Beispielnachweise plus angenommene Angebote |
| GET | `/api/history?type=credential_received` | Historie; auch presentation_sent oder ohne Filter |
| GET / POST | `/api/offers` | Angebote laden / erzeugen; optional `{format:"ldp_vc"}` |
| GET | `/api/offers/:id` | Angebotsdetails |
| POST | `/api/offers/:id/accept` | `{}` → Nachweis speichern, Quittung und Historie |
| POST | `/api/offers/:id/deny` | `{}` → ablehnen |
| GET / POST | `/api/presentations` | Anfragen laden / erzeugen |
| GET | `/api/presentations/:id` | Anfragedetails |
| POST | `/api/presentations/:id/confirm` | `{credentialId, fields:["Vorname","Organisation"], confirmed:true}` |
| GET | `/api/redirect/offer/:id` | HTTP-Redirect zur Empfangsseite |
| GET | `/api/redirect/presentation/:id` | HTTP-Redirect zur Freigabeseite |
| GET | `/api/requests/offer/:id` | Mock credential offer |
| GET | `/api/requests/presentation/:id` | Mock OID4VP-Request mit DCQL-Beispiel |
| POST | `/api/links/resolve` | `{uri:deepLink}` → interne Prüfseiten-Route |
| GET | `/api/issuer-metadata` | illustrative OID4VCI-1.0-Metadaten |
| POST | `/api/nonce` | `{}` → Demo-Nonce |
| POST | `/api/credential` | `{credential_configuration_id:"EmployeeCredential"}` → Demodaten |

Issuer-Metadaten sind auch unter `/.well-known/openid-credential-issuer` erreichbar. Außer Konfiguration, Anmeldung, Metadaten, Nonce und Redirect-/Request-Endpunkten erfordern die Aufrufe `Authorization: Bearer <access_token>`.

## Grenzen und Testdaten

JWTs werden mit HS256 signiert, serverseitig auf Signatur, Issuer, Audience, Ablaufzeit und Sitzung geprüft und beim Logout widerrufen. Der JWT-Schlüssel wird beim Backendstart zufällig erzeugt; optional kann MOCK_JWT_SECRET gesetzt werden. Sitzungen und Benutzerdaten existieren nur im Arbeitsspeicher und sind nach einem Neustart weg. Mehrere Browser mit demo/demo teilen denselben Demo-Datenbestand. Kein Multi-Pod-Betrieb und keine Produktivauthentifizierung.

SD-JWT-Beispiele enthalten echte Base64url-Disclosures und SHA-256-Disclosure-Digests, aber nur eine lokale HMAC-Demosignatur ohne produktive Trust Chain. LDP-VCs enthalten ausdrücklich eine ungültige Demo-Proof-Zeichenfolge. Metadata, Request und Credential-Endpunkte illustrieren OID4VCI/OID4VP und stellen keine vollständige oder zertifizierte OID4VC-1.0-Implementierung dar; insbesondere sind Nonce-/Proof-Bindung, Wallet-Attestierung, externe Verifier und echte LDP-Signaturen nicht implementiert. `ldp_vc` ist ein Legacy-Beispiel.

Tests: `npm run mock:test`. Sie prüfen Signaturmanipulation, abgelaufene und widerrufene JWTs, SD-Disclosures, Sprachwahl, Annahme, Quittungen, Historie, doppelte Bearbeitung, Bestätigung, Übermittlung unerlaubter Felder und Deep-Link-Validierung.

## OID4VP-Auswahl und selektive Offenlegung

Die Präsentationsseite verwendet jetzt die API-Vorauswahl statt einer eigenen Filterung im Browser:

1. `GET /api/mock/presentations/:id/candidates` liefert `dcqlQuery`, `candidates`, gültige `combinations` und `suggestedSelection`.
2. Die API empfiehlt eine minimale Kombination, einen passenden Nachweis je Query und nur die Pflicht-Disclosures. Diese Empfehlung ist keine Freigabe.
3. Auf der Seite können Nutzer Nachweise wechseln bzw. für Queries mit `multiple=true` mehrere Nachweise wählen, optionale Disclosures hinzufügen oder entfernen und eine gültige Kombination wählen. Fehlende Pflichtangaben verhindern die Freigabe.
4. Jede Änderung setzt die ausdrückliche Bestätigung zurück. Die Vorschau zeigt die tatsächlich zu übertragenden Werte.
5. `POST /api/mock/presentations/:id/approve` prüft die Auswahl erneut serverseitig. Es werden nur im gespeicherten Bestand passende Kandidaten, angefragte Disclosures, vollständige Claim-Sets und gültige Query-Kombinationen akzeptiert.
6. Der Mock baut einen `vp_token` je Query. Bei SD-JWT enthält er nur die gewählten Disclosures und ein lokales Demo-Key-Binding-JWT mit Audience, Nonce und SD-Hash. Bei LDP VC wird nach deutlichem Hinweis der gesamte Nachweis übermittelt; echte selektive LDP-Offenlegung wird nicht vorgetäuscht.
7. Eine Quittung speichert Auswahl und geteilte Angaben in der Historie. `GET /api/mock/presentations/:id/response` liefert die Demo-Antwort. `POST .../reject` lehnt eine Anfrage endgültig ab. Abgeschlossene oder abgelehnte Anfragen können nicht erneut freigegeben werden.

Beispiel für den Freigabe-Body:

```json
{
  "presentationId": "employment",
  "approved": true,
  "selections": [
    {
      "queryId": "employment",
      "credentialId": "employee-1",
      "disclosures": ["Vorname", "Organisation"]
    }
  ]
}
```

Die Form `selections/queryId/credentialId/disclosures` und die Routen `candidates`, `approve`, `reject` orientieren sich am lokal bereitgestellten OID4VP-Holder-Code (`internal/api/holderRoutes.go`, `internal/services/holder/selection.go`). Der GitHub-Branch war während der Bearbeitung online nicht abrufbar; es wurde keine Gleichheit zum aktuellen Remote-Stand verifiziert. Der vorliegende Signer-Vertrag lehnt nicht-leere `claimIds` ab und verwendet `disclosures`; deshalb sendet die Demo keine `claimIds`. Die Felder `suggestedSelection`, `combinations`, Anzeige-Metadaten und `approved` sind explizite Mock-Erweiterungen.

Zusätzliche Holder-ähnliche Aliase:

- `/api/presentation/presentations` und `/:id/candidates`, `/:id/approve`, `/:id/reject`.
- Im integrierten Demo-Modus auch `/v1/demo/api/presentation/presentations...`; nur Tenant `demo` wird unterstützt.
- `GET` der Alias-Inbox enthält nur noch offene Anfragen in `{presentations:[...]}`.
- `POST` am Alias nimmt `{url: "openid4vp://authorize?request_uri=...", consentMode:"manual"}` an und erzeugt eine neue gespeicherte Demo-Anfrage. Nur selbst erzeugte lokale Request-URIs werden unterstützt, kein Fetch fremder Request Objects.

Die Aliase verwenden weiterhin die lokale JWT-Demo-Sitzung; sie simulieren keine vertrauenswürdigen XFSC-Gateway-Header, Key-Vault-Identitäten oder vollständige Mandantenisolation. Es wird kein echter externer Verifier kontaktiert und keine produktive Holder-Signatur erzeugt.

Auf `/de/demo/links` gibt es zusätzlich „Kombinierte OID4VP-Anfrage erstellen“. Diese demonstriert einen Beschäftigungsnachweis allein oder zusammen mit einem Legacy-LDP-Qualifikationsnachweis. Zwei vorgefüllte Mitarbeiterausweise bieten eine echte Auswahl zwischen passenden Kandidaten. Optional kann der Nachname offengelegt werden. Der bisherige `/confirm`-Endpunkt bleibt als Legacy-Adapter, nutzt aber dieselbe serverseitige Auswahlprüfung.


## Drittwebsite, Weiterleitung und QR-Bildimport

`npm run demo` startet jetzt auch http://localhost:4101. Diese separate Partnerwebsite zeigt wahlweise eine Präsentationsanfrage oder ein Angebot. „Mit meiner Wallet fortfahren“ öffnet die Wallet mit `uri` als URL-kodiertem Parameter. Nach einer nötigen Anmeldung geht es direkt zur Prüfseite; der Parameter bleibt erhalten.

Alternativ in der Wallet „Anfrage importieren“ öffnen und einen Deep Link, eine direkte QR-Bild-URL oder ein Bild verwenden. Unterstützt sind Upload, Drag-and-drop und Strg/Cmd+V bei fokussiertem Importbereich. Der QR wird im Browser gelesen. Unterstützte Formate: PNG, JPEG, WebP, GIF; maximal 5 MB. Bildquellen werden nur vom Wallet-Origin oder aus der Liste MOCK_IMAGE_ORIGINS geladen, standardmäßig http://localhost:4101. Andere Quellen können als Datei importiert werden. Bild-Weiterleitungen werden nicht verfolgt.

Der Bild-URL-Endpunkt `/api/mock/qr-image?url=...` erfordert eine gültige Demo-JWT-Sitzung und leitet keine Wallet-Credentials zur Bildquelle weiter. Der bisherige lokale HTTP-Redirect bleibt zusätzlich unterstützt. Ein weiteres `npm run mock:merchant` startet nur die Partnerwebsite separat; bei bereits laufendem `npm run demo` ist dieser Befehl nicht nötig.

Es gibt keine automatische Rückleitung oder Ergebnisübertragung an die Partnerwebsite. Das Lesen und Öffnen führt immer erst zur Prüfung und ausdrücklichen Freigabe bzw. Annahme. Echte fremde Request Objects werden weiterhin nicht geladen oder kryptografisch verifiziert.


Die Übersicht aller nötigen Backend-Funktionen einschließlich der Trennung zwischen Mock und echtem Betrieb steht in [docs/backend-endpoints.md](../docs/backend-endpoints.md).

Die Nachweisliste verwendet jetzt `POST /api/credentials` mit `{ "filter": {} }`. Optional sind `filter.search`, `filter.format` und `filter.issuer` (UND-verknüpft). GET ist nicht mehr unterstützt. Details zu Redirects und Authorization stehen in [docs/redirect-routes.md](../docs/redirect-routes.md).
