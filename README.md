# iTIMS

**IT Inventory Management System**: a portable database of every IT device at a site (end-user devices, printers, network gear, industrial equipment and infrastructure), with a floorplan dashboard, photos, reports and QR asset labels. It is meant to be ready to use on day one at a new job.

> **Status: first working version.** The app lives in [`app/`](app). It runs in any modern browser, works offline, installs to a phone or PC home screen, and keeps its data on the device. Logins, shared data between devices and phase 2 monitoring are not built yet.

## Using the app

- **Online:** once GitHub Pages is turned on (repo **Settings > Pages > Source: GitHub Actions**), the app is published from `main` to `https://rfink1972.github.io/iTIMS/`.
- **Install it:** on iPhone open it in Safari, tap **Share**, then **Add to Home Screen**. On Android open it in Chrome, tap **⋮**, then **Install app**. On a PC, click the install icon in the Chrome or Edge address bar.
- **Try it with sample data:** on the empty dashboard click **Load sample devices** (or Settings > Sample data).
- **Your data stays on the device you use.** Make a backup from **Settings > Backup** and keep it somewhere safe; restore it on another device the same way.
- **Run it locally:** `cd app && python3 -m http.server 8000`, then open `http://localhost:8000`. There is no build step.

## Code layout

| Path | What it is |
|---|---|
| `app/index.html`, `app/css/app.css` | Page shell and styles (light, purple, with dark mode) |
| `app/js/schema.js` | Sections, device types, every field and dropdown, from the field dictionary |
| `app/js/store.js`, `app/js/db.js` | Data rules (asset numbers, validation, change log, due dates) and on-device storage (IndexedDB) |
| `app/js/views/` | Dashboard, device page, add/edit form, photos, floorplan, reports, labels, QR scanner, CSV import/export, settings |
| `app/sw.js`, `app/manifest.webmanifest` | Offline support and install details |
| `.github/workflows/pages.yml` | Publishes `app/` to GitHub Pages on every change to `main` |

## What's here

| Path | What it is |
|---|---|
| [`docs/original-spec.md`](docs/original-spec.md) | Rich's original specification |
| [`docs/plan.md`](docs/plan.md) | Spec review, decisions made so far, platform choice, feature list and build order |
| [`docs/field-dictionary.md`](docs/field-dictionary.md) | Every field, by section, with dropdown values and rules (v2) |
| [`docs/future-ideas.md`](docs/future-ideas.md) | Phase 2 ideas: health monitoring and notifications |
| [`mockup/itims-mockup.html`](mockup/itims-mockup.html) | The original clickable mockup the app was built from. |
| [`app/`](app) | The app itself |

## Sections and asset numbers

| Section | Prefix | Covers |
|---|---|---|
| End User Devices | `EU-0001` | PCs, laptops, tablets, phones, handheld scanners |
| Printers | `PR-0001` | Laser, label, check, plotters |
| Network Equipment | `NW-0001` | Switches, routers, firewalls, fiber converters, point-to-point radios, APs |
| Industrial Equipment | `IN-0001` | PLCs, HMIs, connected machines |
| Infrastructure | `SRV-0001` | Servers, storage, UPS/PDU, cameras, NVRs, badge readers |

Asset numbers are assigned on save and never reused.
