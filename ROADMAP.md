# Where MaiGuard could go next

MaiGuard works today: a trusted voice speaks, the alert reaches the right roads by SMS, email and WhatsApp in five languages, and anyone can check a rumour and get one of three honest answers.

This file records what we would look at next, and what would change if MaiGuard ran for many communities rather than one town. Nothing here is committed work; it is a list of things we may be interested in later.

## Before a real community relies on it

**WhatsApp follow-ups after 24 hours.** Meta only allows free-form WhatsApp messages within 24 hours of someone writing to us. A follow-up promise often falls outside that window, where the send fails and is only recorded in the log. This needs an approved message template for alerts, plus a record of each person's opt-in.

**Proving a contact belongs to the person.** Phone numbers and emails are taken at face value, and there is no password reset. One-time codes by SMS and email would fix both, and both channels already send.

**Credentials for trusted voices.** The five demo PINs are public in the README, sessions cannot be revoked, and there is no second factor. The PRD also raises a question we have not answered: a person publicly named as the community's verifier may become a target, which is as much a policy decision as a technical one.

**Deliveries that can be trusted.** Messages are sent and forgotten. A queue with retries, delivery receipts from the SMS provider and WhatsApp, and a record of what each alert cost would show what actually arrived.

**Knowing when something is wrong.** When the AI is unavailable, MaiGuard answers from its rule-based fallback by design, and nobody is told. Uptime checks, error alerts, a backup of the SQLite file and a tested restore would cover this.

**Data protection.** Phone numbers and emails fall under Nigeria's Data Protection Act: a retention policy, a delete-my-data path and a record of consent, plus respecting the DND list for SMS.

## What changes at scale

**Storage.** Every change rewrites all five tables in one transaction. That suits a town; past a few thousand alerts it needs row-level writes, and PostgreSQL only once a single server is no longer enough.

**More than one server.** Live updates, rate limits and the message queue all live inside one process. Running several instances needs shared pub/sub and sending moved into workers.

**Many communities.** Roads, trusted voices and members are one community today. Serving several towns means separating them, each with its own directory and its own trusted voices.

**Geography beyond road names.** Routing matches place names and the aliases people use. Across many towns this wants ward boundaries on a map and a sense of which roads adjoin which, so "the bridge" resolves correctly everywhere.

**Cost per alert.** Each text message costs about four units, and every publish spends four translation calls. Caching translations, batching them and setting spending caps would keep a busy night affordable.

## Product ideas

- **Rumour checks by SMS**, for phones with no internet. It is the one channel still missing.
- **Deputy and night cover** for trusted voices, with escalation when nobody speaks. The PRD names this as the single point of failure.
- **Alerts that expire or resolve**, so "avoid this road" does not live forever.
- **Measuring whether trust moved**: time from an event to the alert, false-alarm rate, how often people check before an alert exists, and whether they wait for a verified message. That is the real measure in the PRD, and nothing records it yet.
- **More languages**, and a check of the existing translations by native speakers.

## Roughly in what order

| | Work | Effort |
|---|---|---|
| 1 | WhatsApp templates, so follow-ups survive the 24-hour window | ~4 h |
| 2 | Verify phone and email; password reset | ~1 day |
| 3 | Delivery queue with retries and receipts | ~1-2 days |
| 4 | Real credentials, revocable sessions, audit log | ~1 day |
| 5 | Backups, uptime checks, error alerts | ~half a day |
| 6 | Rumour checks by SMS | ~1 day |
| 7 | Row-level writes, then separating communities | ~2-3 days |

The first two are what we would want before any real community depends on MaiGuard. The rest can follow demand.
