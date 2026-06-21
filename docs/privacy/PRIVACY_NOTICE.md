# VaultMind Privacy Notice (Draft)

**Regulation:** Nigeria Data Protection Act (NDPA) 2023, regulator: Nigeria Data Protection Commission (NDPC).
**Status:** Phase 0 draft for legal review before publication (PRD Phase 0 deliverable). Not yet legal advice — to be reviewed by qualified counsel and the appointed Data Protection Officer.
**Last updated:** Phase 0.

> Plain-English summary (shown in onboarding, REQ-ONB-003): Your documents stay on your phone. We can't read them. We only ever send a document off your device when you explicitly turn on a specific feature and tap to confirm — and even then, backups are encrypted so we still can't read them.

## 1. Who we are
VaultMind ("we") is the data controller for the limited account data described below. Contact and the Data Protection Officer details will be listed here before launch.

## 2. What we hold, and where
VaultMind is **local-first**. The substance of your data — document files, the text we read from them (OCR), categories, expiry dates, search index, and contract analysis — is stored **only on your device**, encrypted.

On our servers we hold the minimum needed to run accounts, billing, reminders you opt into, and optional backup:

| Data | Purpose | Lawful basis (NDPA) |
|---|---|---|
| Email, phone number | Account, login, security (OTP) | Contract |
| Authentication + session records | Securing your account | Legitimate interest / Contract |
| Subscription & payment status (via Paystack) | Billing | Contract |
| Consent records (what you turned on/off, when) | Legal compliance & your control | Legal obligation |
| Encrypted backup blobs (if you enable backup) | Restore your vault | Consent |
| Security audit events (e.g. hashed IP) | Fraud/abuse prevention | Legitimate interest |

We do **not** store your document contents, OCR text, categories, expiry dates, or analysis results on our servers. Backups are encrypted on your device with a key only you hold; we cannot read them.

## 3. When data leaves your device
Only with your explicit, per-feature consent (you can turn each off at any time in the Consent Centre):

- **Cloud OCR fallback** — if on-device text recognition is unsure, a page may be sent to Google for text extraction, then discarded.
- **Cloud contract analysis (Tier 2)** — a contract you choose to analyse in the cloud is sent to our AI provider (Google, via the Gemini API) for analysis. On the paid tier Google does not use it to train their models.
- **Encrypted backup** — encrypted, unreadable backup files are uploaded to our storage.

These providers are our processors/sub-processors. See §6.

## 4. Third-party processing & retention (important)
For cloud OCR and cloud contract analysis, your content is processed by a third party under their retention terms. We will either (a) operate under a zero-data-retention arrangement with that provider, or (b) tell you plainly, on the consent screen, that the provider may retain the content briefly (e.g. up to 30 days) for abuse-monitoring only and not for training. We will not claim "never stored anywhere" unless a zero-retention arrangement is in place (see `docs/DECISIONS.md` #7). We exclude your data from provider model training.

## 5. Your rights under the NDPA
You can access, correct, delete, or export your data, withdraw consent, and lodge a complaint with the NDPC. In-app: **Settings → Export my data** and **Settings → Delete my account** action these without anyone at VaultMind handling your data manually. Account deletion purges server rows within 24 hours and storage blobs within 72 hours.

## 6. Sub-processors
- **Supabase** — authentication, database, encrypted-backup storage.
- **Google (Gemini API)** — cloud contract analysis (only content you send for Tier-2 analysis).
- **Google Cloud Vision** — cloud OCR fallback (only pages you send for fallback).
- **Paystack** — payments.
- **Resend** — transactional email.
- **Expo** — push notifications.

A current sub-processor list with locations and safeguards will be maintained here.

## 7. Retention
Account data: while your account is active, deleted on account closure (per §5 timelines). Consent records: retained as required for compliance. Security logs: short rolling window.

## 8. Children
VaultMind is not directed at children under 18.

## 9. Changes
Material changes will be notified in-app before they take effect.
