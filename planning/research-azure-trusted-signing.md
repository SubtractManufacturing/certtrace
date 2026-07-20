# Research: Azure Trusted Signing / Artifact Signing for CertTrace Windows installers

**Date:** 2026-07-20  
**Accessed / priced as of:** 2026-07-20 (primary sources cited below)

## Summary verdict

**Conditional yes — Azure Artifact Signing (formerly Trusted Signing) is a viable, Microsoft-recommended path for Authenticode-signing CertTrace’s Tauri Windows NSIS/MSI installers on GitHub Releases**, at roughly **$9.99/month** for the Basic tier, provided CertTrace’s publisher qualifies for Public Trust identity validation (individuals: USA/Canada; organizations: USA/Canada/EU/UK), uses a **paid** Azure subscription (not free/trial/sponsored), and accepts that **signing does not instantly remove SmartScreen warnings**. Reputation still builds over weeks/hundreds of clean installs, same as traditional OV certificates. EV certificates no longer provide an instant SmartScreen bypass. Integration with CertTrace’s existing `windows-latest` GitHub Actions + Tauri pipeline is officially supported (OIDC + `azure/artifact-signing-action`, or Tauri `signCommand` via `artifact-signing-cli`). SignPath Foundation remains a strong **$0** alternative if the project qualifies as open source; otherwise Azure is typically cheaper and smoother for CI than buying a traditional OV cert (~$150–500/yr + HSM/token).

**Operator handoff:** §7 lists accounts to open, human-only Azure portal / identity steps, GitHub secrets to create, and the exact handoff text for an AI agent to wire CI afterward.

---

## Project context

| Item | Detail |
|------|--------|
| App | **CertTrace** — Tauri desktop app (Rust + React) |
| Windows artifacts | NSIS (`-setup.exe`) and/or MSI via Tauri (`bundle.targets`: `"all"` in `apps/desktop/src-tauri/tauri.conf.json`) |
| Distribution | GitHub Releases (`.github/workflows/release.yml` — `tauri-apps/tauri-action` on `windows-latest`) |
| Roadmap | [planning/roadmap.md](roadmap.md): “Code signing (Apple notarization + Windows via SignPath or purchased cert)” |
| Goal | Reduce/eliminate Windows SmartScreen / “Windows protected your PC” over time by Authenticode-signing builds |
| Assumption | Reputation takes time; question is whether starting now with Azure is viable |

---

## 1. What exactly is the ~$10/month Azure offering?

### Product name

The product is **Azure Artifact Signing**, formerly **Azure Trusted Signing** (also referred to historically as Azure Code Signing in some tooling). Microsoft states there is no functional difference — only a rebrand.

- Product page: https://azure.microsoft.com/en-us/products/artifact-signing  
- Overview: https://learn.microsoft.com/en-us/azure/artifact-signing/overview  
- FAQ on rename: https://azure.microsoft.com/en-us/products/artifact-signing (FAQ: “What happened to Trusted Signing?”)

Existing customers may still see “Trusted Signing” in client tools (e.g. older `azure/trusted-signing-action` redirects / WinGet IDs); new customers should use Artifact Signing naming. Official GitHub Action: https://github.com/Azure/artifact-signing-action

### Pricing tiers (published numbers)

Microsoft documents two consumption-based SKUs:

| SKU | Monthly base | Included signatures / month | Overage | Certificate profiles |
|-----|--------------|-----------------------------|---------|----------------------|
| **Basic** | **$9.99** per account | 5,000 | **$0.005** / signature | 1 of each available type |
| **Premium** | **$99.99** per account | 100,000 | **$0.005** / signature | 10 of each available type |

Sources (both Public Trust and Private Trust signing included on both tiers):

- SKU docs: https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-change-sku (last updated 2026-01-08; table quotes $9.99 / $99.99)  
- Product FAQ (USD): https://azure.microsoft.com/en-us/products/artifact-signing — “Basic Plan: $9.99/month for up to 5,000 signatures; $0.005 per additional signature. Premium Plan: $99.99/month…”  
- Pricing page: https://azure.microsoft.com/en-us/pricing/details/trusted-signing/ (same quotas; portal may localize currency — quote USD from Learn/product FAQ when regions differ)

**Billing notes (official):**

- Billing starts when you create an Artifact Signing account (not when you first sign).  
- Pricing is **not pro-rated** — full monthly SKU amount is charged regardless of when in the cycle you start.  
  - https://learn.microsoft.com/en-us/azure/artifact-signing/faq (“Is the pricing pro-rated…”)  
  - https://azure.microsoft.com/en-us/pricing/details/trusted-signing/

**Free trial:** Artifact Signing itself does **not** support free, trial, or sponsored Azure subscriptions. A **paid** subscription (e.g. pay-as-you-go or EA) is required.

- https://learn.microsoft.com/en-us/azure/artifact-signing/faq#can-i-use-artifact-signing-with-a-free-trial-or-sponsored-azure-subscription

### Certificate types: public vs private trust

Artifact Signing supports multiple **certificate profile types**, aligned to two trust models:

| Profile type | Trust | Use for CertTrace public GitHub Releases? |
|--------------|-------|-------------------------------------------|
| **PublicTrust** | Publicly trusted (Microsoft Root Program) | **Yes — this is the one to use** |
| PublicTrustTest | Not publicly trusted | Dev/test only |
| PrivateTrust / PrivateTrustCIPolicy | Not default-trusted on Windows | Internal / WDAC — **not** for public download |
| VBSEnclave | Specialized | Not needed for installers |

Sources:

- Trust models: https://learn.microsoft.com/en-us/azure/artifact-signing/concept-trust-models  
- Resources/roles (profile types): https://learn.microsoft.com/en-us/azure/artifact-signing/concept-resources-roles  
- CLI profile types: https://learn.microsoft.com/en-us/cli/azure/artifact-signing/certificate-profile

**Public Trust** certificates are issued from the **Microsoft Identity Verification Root Certificate Authority 2020**, which is in the **Microsoft Root Certificate Program**, and are designed for Windows Authenticode / Win32 code signing, Smart App Control, and related features.

- https://learn.microsoft.com/en-us/azure/artifact-signing/concept-trust-models#public-trust-model  
- Microsoft Root Program requirements: https://learn.microsoft.com/en-us/security/trusted-root/program-requirements

### OV vs EV vs “something else”

- Artifact Signing does **not** issue **EV** certificates, and Microsoft states there is no plan to.  
  - https://learn.microsoft.com/en-us/azure/artifact-signing/faq#does-artifact-signing-issue-ev-certificates  
- Microsoft does **not** market Public Trust profiles as classic DigiCert/Sectigo “OV” product SKUs. Functionally, Microsoft’s Windows developer guidance treats Artifact Signing’s SmartScreen behavior as **equivalent to OV**: verified publisher identity + reputation builds over time.  
  - https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options  
- Identity validation is either **Organization** or **Individual** Public Trust validation (see §3), which produces a certificate subject with validated legal name (CN/O per CA/Browser Forum CSBRs). Custom CN/O is not supported.  
  - https://learn.microsoft.com/en-us/azure/artifact-signing/faq#can-i-use-a-custom-cn-or-a-custom-o-with-artifact-signing

### Short-lived certificates

- Certificates are **renewed daily** and are valid for **only 72 hours**.  
- Private keys are **not** exportable; keys live in Microsoft-managed **FIPS 140-2 Level 3** HSMs.  
- **RFC 3161 timestamping is required** so signatures remain valid after the short-lived cert expires. Microsoft provides `http://timestamp.acs.microsoft.com`.  
- A durable identity is represented via a custom **EKU** (not via certificate thumbprint pinning).

Source: https://learn.microsoft.com/en-us/azure/artifact-signing/concept-certificate-management

### Hardware key requirements

- **No USB token** for the subscriber.  
- Keys are generated/stored/used inside service-managed FIPS 140-2 Level 3 HSMs; import/export of private keys is not supported.  
- Signing is digest/content-confidential: the full file need not leave the signing endpoint in the same way a local PFX would; SignTool + dlib / GitHub Action / SDK perform the signing flow against Azure.

Sources:

- https://learn.microsoft.com/en-us/azure/artifact-signing/overview  
- https://learn.microsoft.com/en-us/azure/artifact-signing/concept-certificate-management  
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options (“No hardware token required”)

---

## 2. Does it produce Authenticode signatures that Windows SmartScreen trusts?

### Public Authenticode trust

**Yes (for Public Trust profiles).** Microsoft documents that Public Trust certificates chain to a root in the Microsoft Root Certificate Program and are designed for Windows Authenticode signing and features that consume code signatures (including SmartScreen / Smart App Control).

- https://learn.microsoft.com/en-us/azure/artifact-signing/concept-trust-models  
- Product: “certificates that are fully managed through certificate authorities that are part of the Microsoft Trusted Root Certificate program” — https://azure.microsoft.com/en-us/products/artifact-signing

FAQ also states you can sign all file types SignTool supports, and that the Authenticode cert itself is never handed to you (only used at signing time; public cert embedded in the signed binary).

- https://learn.microsoft.com/en-us/azure/artifact-signing/faq

### SmartScreen reputation — signing alone is not enough

Microsoft’s explicit guidance:

1. SmartScreen evaluates **publisher reputation** and **file-hash reputation**.  
2. Even with a valid OV/EV (or Artifact Signing) certificate, **new files often show a warning** until reputation accumulates.  
3. There is **no exact threshold**; guidance cites on the order of **several weeks and hundreds of clean installs** from a wide audience.  
4. **EV no longer bypasses SmartScreen** (behavior removed; Microsoft documents this as of the 2024 change). Paying for EV solely for SmartScreen is “no longer justified.”  
5. Artifact Signing **does not provide instant SmartScreen trust** — same reputation-building model as OV.  
6. Signing consistently with the same publisher identity can help **new versions** inherit certificate/publisher reputation better than unsigned updates (which rebuild from zero each version).  
7. There is generally **no consumer mechanism to manually request SmartScreen whitelist**; reputation builds via downloads. (Enterprise SI submission is a different, optional path.)

Primary sources:

- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation (last updated 2026-05-06)  
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options  
- https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide  
- Artifact Signing FAQ (“What can I expect when I see SmartScreen prompts…”): https://learn.microsoft.com/en-us/azure/artifact-signing/faq

**Implication for CertTrace:** Starting Azure signing **now** is still valuable — each signed release can accumulate publisher/file reputation — but users should expect the blue SmartScreen interstitial for early downloads. This matches the user’s understanding.

### Difference from traditional DigiCert/Sectigo OV/EV

| Dimension | Azure Artifact Signing (Public Trust) | Traditional OV | Traditional EV |
|-----------|--------------------------------------|----------------|----------------|
| Root trust | Microsoft Identity Verification root / Microsoft Root Program | Commercial CA in root program | Commercial CA (stricter validation) |
| SmartScreen (post-2024) | Reputation builds over time | Same | **Same as OV** (no instant bypass) |
| Key custody | Cloud HSM, no export, no USB | USB token or cloud HSM (CA/B Forum since June 2023) | Typically token/HSM |
| Cert lifetime | 72h, auto-renewed | Typically 1–3 years | Typically 1–3 years |
| Cost (ballpark) | ~$9.99/mo Basic (~$120/yr) | Microsoft cites ~$150–300/yr (options page) or ~$300–500/yr (MSIX guide) | Microsoft cites $400+/yr; not justified for SmartScreen alone |
| CI fit | First-class GitHub Actions / SignTool dlib | Possible but token/HSM friction | Higher friction/cost |

Sources: code-signing-options + MSIX guide + certificate-management + FAQ (EV) links above.

**Note:** Project [planning/decisions.md](decisions.md) still says EV yields “Faster SmartScreen trust.” That guidance is **outdated relative to current Microsoft docs** (EV ≠ instant SmartScreen as of the documented 2024 change). Prefer the SmartScreen reputation article when budgeting.

---

## 3. Eligibility / org requirements

### Who can buy Public Trust?

From the official quickstart and FAQ:

- **Organizations:** USA, Canada, European Union, United Kingdom  
- **Individual developers:** USA and Canada only  
- Geographic limit **does not apply** to Private Trust (irrelevant for public GitHub Releases)

Sources:

- https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart  
- https://learn.microsoft.com/en-us/azure/artifact-signing/faq#what-if-my-countryregion-isnt-listed-in-countryregion-drop-down-list-on-the-identity-validation-page  
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options

### Identity verification

- Must complete **identity validation** in the Azure portal (not CLI).  
- Requires **Artifact Signing Identity Verifier** RBAC role.  
- **Organization** path: legal business entity details, website, emails, business identifier, address; plus an individual representative completes personal verification; processing **1–20 business days** (longer if more docs requested).  
- **Individual** path: details sourced from Azure **billing account** (must be Account Type “Individual”); government ID + Verified ID flow (e.g. AU10TIX); billing name/address must match intended certificate subject.  
- Billing account type must match validation type (individual billing ≠ org validation and vice versa).  
- Identity validation can expire; if not renewed, certificate renewal/signing stops.

Sources: https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart (identity validation sections) and FAQ identity section.

### Azure subscription / Entra ID

Prerequisites:

- Microsoft Entra tenant  
- Azure subscription (paid — see §1)  
- Register resource provider `Microsoft.CodeSigning`  
- Artifact Signing account in a supported region (many US/EU/etc. regions with `*.codesigning.azure.net` endpoints)

Source: https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart

### Blockers for a small indie / OSS project

Possible blockers:

1. **Geography** — individual outside US/Canada cannot use Public Trust; must use org in allowed regions, traditional OV, or SignPath.  
2. **Paid Azure subscription** — free credits / Visual Studio / student / sponsored offers are explicitly unsupported.  
3. **Identity validation failure** — incomplete public records, email verification missed (7-day link), mismatched billing vs certificate subject.  
4. **Billing starts on account creation** even before validation completes — failed validation may mean delete the account to stop charges (FAQ advice).  
5. **Publisher name** will be the validated legal/individual name (not an arbitrary brand/CN).

None of these are unique “OSS blockers” if the maintainer is US/CA (individual) or has an eligible org — but they are real setup gates.

---

## 4. CI/CD integration for CertTrace

### GitHub Actions on Windows runners

**Yes.** Microsoft lists GitHub Actions as a first-class integration. The official action runs only on Windows runners (`windows-2022` / `windows-2025` / `windows-latest`; not Windows ARM hosted runners).

- Integrations list: https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations  
- Action: https://github.com/Azure/artifact-signing-action  
- MSIX guide example: https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide

CertTrace already builds Windows on `windows-latest` in `.github/workflows/release.yml` via `tauri-apps/tauri-action@v0` — a compatible host for signing.

### Official tools

| Integration | Notes |
|-------------|-------|
| `azure/artifact-signing-action` | Sign files/folders after build; supports `exe`, `dll`, `msi`, `msix`, etc. filters |
| SignTool + Artifact Signing dlib | Local/CI Windows; metadata JSON with endpoint, account, profile |
| Azure CLI / Azure login | Auth for OIDC or service principal |
| Timestamp | `http://timestamp.acs.microsoft.com` (RFC 3161) — critical for 72h certs |

OIDC (recommended): create Entra app + federated credential for the GitHub repo; grant **Artifact Signing Certificate Profile Signer** role; workflow needs `permissions: id-token: write`; use `azure/login` then artifact-signing-action.

- OIDC docs in action repo: https://github.com/Azure/artifact-signing-action/blob/main/docs/OIDC.md  
- GitHub OIDC with Azure: https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure  
- Roles: https://learn.microsoft.com/en-us/azure/artifact-signing/concept-resources-roles

Secrets typically needed (OIDC path — prefer over long-lived client secrets):

- `AZURE_CLIENT_ID`  
- `AZURE_TENANT_ID`  
- `AZURE_SUBSCRIPTION_ID`  
- Account endpoint / account name / certificate profile name (can be secrets or vars)

### Compatibility with Tauri

Tauri documents **Azure Artifact Signing** specifically (formerly Trusted Signing / Azure Code Signing):

- Official docs: https://v2.tauri.app/distribute/sign/windows/ (section “Azure Artifact Signing”)  
- Source: https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/distribute/Sign/windows.mdx  

**Important:** Classic `certificateThumbprint` + imported PFX **does not apply** — Artifact Signing keys are not exportable. Use:

```json
{
  "bundle": {
    "windows": {
      "signCommand": "artifact-signing-cli -e https://wus2.codesigning.azure.net -a MyAccount -c MyProfile -d MyApp %1"
    }
  }
}
```

(`%1` = path Tauri passes for each binary/installer to sign.) Community/tooling: `artifact-signing-cli` (documented by Tauri); alternatively sign release artifacts post-build with `azure/artifact-signing-action` if preferring action-based signing outside Tauri’s bundler hook.

Also available: generic `signCommand` for any SignTool-compatible flow — https://v2.tauri.app/distribute/sign/windows/#custom-sign-command

### What artifacts need signing

For GitHub Release downloads that trigger SmartScreen:

- **NSIS installer** (`*-setup.exe`) — primary download path (CertTrace workflow sets `updaterJsonPreferNsis: true`)  
- **MSI** (if published; `targets: "all"` builds both)  
- Prefer signing **all published PE installers** users download; unsigned updater payloads would re-trigger reputation issues per Microsoft’s “sign every release” guidance  

SignTool-supported types are in scope per FAQ. Tauri’s bundler invokes `signCommand` on produced Windows binaries/installers during `tauri build`.

Microsoft SmartScreen guidance: sign every release; do not modify files after signing; keep a consistent signing identity.

- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation

---

## 5. Brief comparison to roadmap alternatives

### SignPath (OSS / Foundation)

- **SignPath Foundation** offers **free** code signing for qualifying open-source projects; they vouch that binaries were built from the OSS repo; keys on their HSM; CI integration (including GitHub Actions).  
  - https://signpath.org/  
  - https://signpath.io/solutions/open-source-community  
  - Docs: https://docs.signpath.io/  
  - GitHub connector: https://docs.signpath.io/trusted-build-systems/github  
- Microsoft’s own Windows code-signing options page also points OSS projects at SignPath Foundation.  
  - https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options  
- **Cost:** $0 if approved; commercial SignPath exists separately (not required if Foundation-eligible).  
- **Complexity:** Application + policy + GitHub App; approval not guaranteed.  
- **SmartScreen:** Still Authenticode + reputation dynamics; publisher may appear as SignPath Foundation’s identity model (they vouch for the project) rather than the indie’s legal name — different trust UX than Azure Public Trust in your own name.  
- Already on CertTrace roadmap / decisions as preferred evaluate-first option.

### Traditional purchased OV/EV

- OV: Microsoft cites roughly **$150–300/year** (code-signing-options) or **$300–500/year** (MSIX guide) — treat as a range; buy from DigiCert/Sectigo/GlobalSign/etc.  
- Since June 2023, CA/Browser Forum requires OV private keys on HSM/token — CI needs cloud HSM or awkward token handling.  
- EV: higher cost; **no SmartScreen advantage** per current Microsoft docs.  
- SmartScreen: equivalent reputation model to Artifact Signing for OV.

### Cost / complexity / reputation (rough)

| Option | Approx. cost | Setup complexity | SmartScreen | Fits CertTrace CI |
|--------|--------------|------------------|-------------|-------------------|
| **Azure Artifact Signing Basic** | **$9.99/mo** (~$120/yr) + paid Azure sub | Medium (Azure + identity + OIDC) | Reputation over time | Excellent (official Action + Tauri docs) |
| **SignPath Foundation** | **$0** if eligible | Medium (apply + policies) | Reputation over time; Foundation-vouched identity | Good (GitHub Action) |
| **Traditional OV** | ~$150–500/yr + HSM/token | Medium–high | Same as Azure | Moderate (token/HSM friction) |
| **Traditional EV** | $400+/yr | High | **No better than OV** for SmartScreen | Moderate–high |

---

## 6. Practical recommendation for CertTrace

### Would Azure Trusted Signing / Artifact Signing work?

**Conditional yes.**

It will Authenticode-sign CertTrace Windows installers with a Microsoft Root Program–trusted Public Trust certificate, integrate with the existing GitHub Actions Windows job, and put CertTrace on the same SmartScreen reputation treadmill Microsoft recommends for non-Store apps — **if** eligibility and paid Azure subscription requirements are met.

### Prerequisites (short list)

1. Publisher in an eligible geography (individual US/CA, or org US/CA/EU/UK).  
2. Paid Azure subscription (pay-as-you-go or EA — not free/trial/sponsored).  
3. Entra ID tenant; ability to create app registration + federated credentials for GitHub OIDC.  
4. Successful Public Trust identity validation (plan days–weeks).  
5. Artifact Signing account (Basic SKU is enough) + **PublicTrust** certificate profile.  
6. RBAC: Identity Verifier (setup) + Certificate Profile Signer (CI principal).  
7. Workflow changes: `id-token: write`, Azure login, Tauri `signCommand` and/or post-build `azure/artifact-signing-action`; always timestamp.  
8. Expect early SmartScreen warnings; communicate to beta users.

---

## 7. Operator checklist: accounts, manual steps, then agent implementation

This section is the handoff boundary. **Humans must finish identity, billing, and Azure portal setup.** An AI agent can wire GitHub Actions / Tauri once the secrets and resource names below exist.

Primary Microsoft guide: https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart  
OIDC + GitHub: https://github.com/Azure/artifact-signing-action/blob/main/docs/OIDC.md  
Connect GitHub to Azure: https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure

### 7.1 Eligibility / decision (human)

Before opening paid resources:

| Decision | CertTrace default / notes |
|----------|---------------------------|
| Public Trust geography | Individuals: **USA or Canada** only. Organizations: **USA, Canada, EU, UK**. |
| Individual vs organization validation | Must match Azure **billing account type** (Individual billing ↔ individual validation; org billing ↔ org validation). |
| Publisher name on SmartScreen | Will be the **validated legal / individual name**, not an arbitrary brand string (e.g. not a custom “CertTrace” CN). |
| SKU | **Basic ($9.99/mo)** is enough (5k signatures). Billing starts when the Artifact Signing **account** is created — not when you first sign. Not pro-rated. |
| Paid Azure only | Free / trial / sponsored / Visual Studio credit subscriptions are **not** supported for Artifact Signing. |

If identity validation fails after you created the account, **delete the Artifact Signing account** to stop monthly charges (per Microsoft FAQ).

### 7.2 Accounts and access to open (human)

Open / confirm these in order:

1. **Microsoft account** that can administer Azure (work/school Entra identity preferred for org; personal Microsoft account can work for individual).  
2. **Microsoft Entra ID tenant** (every Azure subscription has one; create/use an existing directory).  
   - https://learn.microsoft.com/en-us/entra/fundamentals/create-new-tenant  
3. **Paid Azure subscription** (Pay-As-You-Go or Enterprise Agreement).  
   - https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/create-subscription  
4. **Azure billing account** whose legal name + address you want on the certificate (must match validation type). Review before starting validation:  
   - https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/manage-billing-accounts  
5. **GitHub repo admin** on `SubtractManufacturing/certtrace` (to add Actions secrets/vars and confirm OIDC subject).  
6. *(Optional later)* Website / email lead-magnet hosting for the pinned Windows installer — not required for Azure setup, but part of the SmartScreen download strategy (see §7.7).

You do **not** need: DigiCert/Sectigo account, USB token, Apple-style developer program for Windows, or a separate HSM.

### 7.3 Manual Azure portal steps (human — required before agent work)

Do these yourself (identity validation **cannot** be done via CLI or by an agent):

#### A. Register the resource provider

1. Azure Portal → **Subscriptions** → select the paid subscription.  
2. **Resource providers** → register **`Microsoft.CodeSigning`**.  
3. Wait until status is **Registered**.

#### B. Create Artifact Signing account

1. Search **Artifact Signing Accounts** → **Create**.  
2. Choose subscription, resource group (create e.g. `rg-certtrace-signing`), account name (3–24 chars, globally unique), region (e.g. West US 2 → endpoint `https://wus2.codesigning.azure.net`).  
3. Pricing: **Basic**.  
4. **Review + Create**.  
5. Record for later:
   - Artifact Signing **account name**
   - **Endpoint URI** for the region (from Microsoft region table)
   - Resource group + subscription ID

#### C. Assign yourself Identity Verifier (if needed)

1. On the Artifact Signing account, ensure your user has **Artifact Signing Identity Verifier**.  
2. If **New identity** is dimmed, fix RBAC first:  
   - https://learn.microsoft.com/en-us/azure/artifact-signing/concept-resources-roles  

#### D. Complete Public Trust identity validation (portal only; 1–20 business days)

**Organization path** (if Subtract Manufacturing / company is the publisher):

- Legal organization name, website, primary + secondary emails, business identifier, business address.  
- An individual representative completes personal ID verification (name must match government ID).  
- Primary email receives verification links (**7-day expiry**); keep public business records current.

**Individual path** (if you personally are the publisher):

- Details come from the Azure **billing account** (Account Type = Individual).  
- Government ID + Microsoft Verified ID flow.  
- Billing legal name/address must **exactly** match what you want on the certificate.

Wait until validation status is **Completed**. Do not create the PublicTrust certificate profile until then.

#### E. Create PublicTrust certificate profile

1. Artifact Signing account → **Certificate profiles** → **Create** → type **Public Trust**.  
2. Name it something stable (e.g. `certtrace-windows-public`).  
3. Bind **Verified CN / O** to the completed identity validation.  
4. Record the **certificate profile name**.

#### F. Create Entra app + GitHub OIDC (human; agent can assist with YAML later)

Goal: GitHub Actions authenticates to Azure **without** a long-lived client secret.

1. Entra ID → **App registrations** → **New registration** (e.g. `certtrace-github-artifact-signing`).  
2. Note **Application (client) ID** and **Directory (tenant) ID**.  
3. **Certificates & secrets** → **Federated credentials** → add credential for GitHub Actions:  
   - Organization: `SubtractManufacturing`  
   - Repository: `certtrace`  
   - Entity: prefer **Environment** (e.g. `release`) or **Branch** (`main`) matching how releases run — subject must match the workflow that signs.  
4. On the Artifact Signing account / certificate profile, assign the app’s service principal the role **Artifact Signing Certificate Profile Signer**.  
5. Confirm the app can use the subscription (IAM as needed).

Official OIDC notes: https://github.com/Azure/artifact-signing-action/blob/main/docs/OIDC.md

#### G. Add GitHub Actions secrets / variables (human)

In `SubtractManufacturing/certtrace` → Settings → Secrets and variables → Actions, add at least:

| Name | Type | Value |
|------|------|--------|
| `AZURE_CLIENT_ID` | secret | Entra app (client) ID |
| `AZURE_TENANT_ID` | secret | Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | secret | Azure subscription ID |
| `AZURE_ARTIFACT_SIGNING_ACCOUNT` | secret or var | Artifact Signing account name |
| `AZURE_ARTIFACT_SIGNING_PROFILE` | secret or var | PublicTrust certificate profile name |
| `AZURE_ARTIFACT_SIGNING_ENDPOINT` | secret or var | Region endpoint, e.g. `https://wus2.codesigning.azure.net` |

Keep existing updater secrets (`TAURI_SIGNING_PRIVATE_KEY`, etc.) — those are separate from Authenticode.

### 7.4 Handoff: what to give an AI agent when manual setup is done

Paste a short note like:

```text
Azure Artifact Signing is ready for CertTrace CI.

- Repo: SubtractManufacturing/certtrace
- Workflow to change: .github/workflows/release.yml (windows-latest job)
- OIDC: AZURE_CLIENT_ID / AZURE_TENANT_ID / AZURE_SUBSCRIPTION_ID are in GitHub Actions secrets
- Account: <account-name>
- Certificate profile: <profile-name> (PublicTrust)
- Endpoint: https://<region>.codesigning.azure.net
- Federated credential subject matches: <environment or branch>
- Identity validation: Completed (Public Trust)
- SKU: Basic

Implement: Authenticode-sign Windows NSIS (and MSI if published) on release using
azure/login + azure/artifact-signing-action and/or Tauri bundle.windows.signCommand
with artifact-signing-cli. Always RFC 3161 timestamp (http://timestamp.acs.microsoft.com).
Do not commit secrets. Update planning/release-runbook.md with the new secrets.
```

**Do not** paste client secrets into chat if you used a client secret instead of OIDC — prefer OIDC only.

### 7.5 What an AI agent can implement (after §7.3–7.4)

Safe for agent once secrets exist:

- Update `.github/workflows/release.yml`: `permissions: id-token: write`, `azure/login`, sign step or Tauri `signCommand`.  
- Configure `apps/desktop/src-tauri/tauri.conf.json` `bundle.windows.signCommand` if using CLI-during-bundle.  
- Document secrets in `planning/release-runbook.md` and note EV/SmartScreen corrections in `planning/decisions.md` if asked.  
- Help verify a dry-run / release checklist (`Get-AuthenticodeSignature`, `signtool verify`).

**Agent cannot / should not do:** identity validation, government ID, billing account legal edits, creating paid Azure subscriptions in your name, or clicking through Microsoft Verified ID.

### 7.6 Rough end-to-end order (human → agent → human)

1. **Human:** paid Azure + Entra + billing info correct.  
2. **Human:** register `Microsoft.CodeSigning`, create Artifact Signing account (Basic).  
3. **Human:** Public Trust identity validation → wait for **Completed**.  
4. **Human:** PublicTrust certificate profile.  
5. **Human:** Entra app + GitHub federated credential + Certificate Profile Signer role.  
6. **Human:** GitHub Actions secrets/vars.  
7. **Agent:** wire release workflow + Tauri signing config + runbook.  
8. **Human:** cut a signed release; confirm signature on the NSIS; smoke-test install + in-app updater.  
9. **Ongoing human:** renew identity validation before expiry; keep the **same** signing identity; optionally pin a website installer for SmartScreen volume (§7.7).

### 7.7 Related CertTrace distribution plan (SmartScreen, not Azure-specific)

Agreed product approach (separate from Azure account setup):

- Funnel most Windows users via the **website** (email lead magnet → **link** to download, not an `.exe` attachment).  
- **Pin** one Authenticode-signed NSIS on the site for months so that **hash** can accumulate SmartScreen reputation.  
- Ship frequent updates via **Tauri in-app updater** (`latest.json`); existing installs need not re-download the pinned site installer.  
- GitHub Releases remain available; SmartScreen there is lower priority.  
- Still Authenticode-sign **every** updater NSIS, even if the marketing download is frozen.

### Caveats

- **Reputation delay** — not instant; weeks + many clean installs.  
- **Region / eligibility** — hard geographic gates for Public Trust.  
- **Org/individual verification** — can fail or take up to ~20 business days.  
- **Short-lived certs** — must timestamp; do not pin by thumbprint for trust policies.  
- **Billing** — full month from account creation; delete unused account if validation fails.  
- **No EV** — irrelevant for SmartScreen today, but enterprise buyers sometimes still ask for EV from commercial CAs.  
- **Publisher display name** — legal validated name, not a custom brand string.  
- **Tauri docs** still contain older EV “immediate reputation” notes in the OV section; prefer Microsoft SmartScreen article for policy.

### Right long-term path vs SignPath vs traditional CA?

| If… | Prefer… |
|-----|---------|
| CertTrace is (or will be) **open source** and Foundation-eligible | **Evaluate SignPath Foundation first** ($0; already on roadmap) |
| Closed-source / SignPath declined / want **publisher name = your legal identity** / want Microsoft’s recommended non-Store path | **Azure Artifact Signing Basic** |
| Outside Public Trust geography as an individual, and not OSS-eligible | **Traditional OV** from a CA |
| Buying EV “for SmartScreen” | **Do not** — Microsoft says it no longer helps |

For CertTrace specifically: **starting Azure Artifact Signing now is a sound plan** if eligibility is clear and SignPath is slow/uncertain — monthly cost is low, CI fit is excellent, and earlier consistent signing is how reputation starts. Parallel-track a SignPath Foundation application if the repo will be OSS, since $0 and roadmap alignment are attractive; the two are not mutually exclusive to *research*, but you only need one production signer.

---

## Sources

### Microsoft / Azure

- https://azure.microsoft.com/en-us/products/artifact-signing  
- https://azure.microsoft.com/en-us/pricing/details/trusted-signing/  
- https://learn.microsoft.com/en-us/azure/artifact-signing/overview  
- https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart  
- https://learn.microsoft.com/en-us/azure/artifact-signing/concept-trust-models  
- https://learn.microsoft.com/en-us/azure/artifact-signing/concept-certificate-management  
- https://learn.microsoft.com/en-us/azure/artifact-signing/concept-resources-roles  
- https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-change-sku  
- https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations  
- https://learn.microsoft.com/en-us/azure/artifact-signing/faq  
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options  
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation  
- https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide  
- https://learn.microsoft.com/en-us/security/trusted-root/program-requirements  
- https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure  
- https://github.com/Azure/artifact-signing-action  
- https://github.com/Azure/artifact-signing-action/blob/main/docs/OIDC.md  

### Tauri

- https://v2.tauri.app/distribute/sign/windows/  
- https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/distribute/Sign/windows.mdx  

### SignPath

- https://signpath.org/  
- https://signpath.io/solutions/open-source-community  
- https://docs.signpath.io/  
- https://docs.signpath.io/trusted-build-systems/github  

### CertTrace (local)

- `.github/workflows/release.yml`  
- `apps/desktop/src-tauri/tauri.conf.json`  
- `planning/roadmap.md`  
- `planning/decisions.md`  
- `planning/release-runbook.md`  
