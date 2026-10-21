# 0003: Count contacts as they're read

- **Status:** Accepted
- **Date:** 2026-10-19
- **Origin:** Claude's suggestion, accepted. It was part of the plan Claude proposed before any code, which I approved.

## Context

Relationship strength is the number of contacts between a partner and all of a company's employees. Contacts will be by far the most common line in a real network file.

## Decision

The network keeps `Map<company, Map<partner, count>>`. Each `Contact` looks up its employee's company and increments that pair immediately; the contact itself isn't stored.

## Consequences

- Memory grows with company/partner pairs, not contacts, and ranking is one pass over the counts with no join.
- Per-contact detail (type, which employee) is gone once counted. Questions such as "who at ACME do we know?" or weighting coffee above email would need a contact log kept next to the counts. ROADMAP.md lists both.
- Contacts must come after the declarations they refer to, since there's nothing to resolve later. See [0004](./0004-lenient-by-default-strict-mode.md).
