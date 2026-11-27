# iTIMS

**IT Inventory Management System**: a portable database of every IT device at a site (end-user devices, printers, network gear, industrial equipment and infrastructure), with a floorplan dashboard, photos, reports and QR asset labels. It is meant to be ready to use on day one at a new job.

> **Status: Pencil and Paper.** This repository holds planning documents and a clickable mockup only. No application code has been written yet. The build starts when Rich commissions it.

## What's here

| Path | What it is |
|---|---|
| [`docs/original-spec.md`](docs/original-spec.md) | Rich's original specification |
| [`docs/plan.md`](docs/plan.md) | Spec review, decisions made so far, platform choice, feature list and build order |
| [`docs/field-dictionary.md`](docs/field-dictionary.md) | Every field, by section, with dropdown values and rules (v2) |
| [`docs/future-ideas.md`](docs/future-ideas.md) | Phase 2 ideas: health monitoring and notifications |
| [`mockup/itims-mockup.html`](mockup/itims-mockup.html) | Clickable dashboard mockup with sample data. Open it in a browser. |

## Sections and asset numbers

| Section | Prefix | Covers |
|---|---|---|
| End User Devices | `EU-0001` | PCs, laptops, tablets, phones, handheld scanners |
| Printers | `PR-0001` | Laser, label, check, plotters |
| Network Equipment | `NW-0001` | Switches, routers, firewalls, fiber converters, point-to-point radios, APs |
| Industrial Equipment | `IN-0001` | PLCs, HMIs, connected machines |
| Infrastructure | `SRV-0001` | Servers, storage, UPS/PDU, cameras, NVRs, badge readers |

Asset numbers are assigned on save and never reused.
