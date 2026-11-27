# iTIMS: Plan

Status: Pencil and Paper (planning only). Last updated 2026-11-27.

## Decisions so far

| Topic | Decision |
|---|---|
| Name | iTIMS, IT Inventory Management System |
| Users | Rich first; possibly a team later, so plan for logins and roles (view / edit) |
| Platforms | Must work on web, iOS and Android. A PC app is only a fallback. |
| Offline | Wanted |
| Asset numbers | Per-section prefix (EU-, PR-, NW-, IN-, SRV-) + 4 digits, never reused |
| Sections | The four from the spec, plus **Infrastructure (SRV-)** for servers, storage, UPS/PDU, cameras, NVRs, badge readers |
| State | Split into **Condition** (Operational, Degraded, Down, Hardware Issue, Software Issue) and **Lifecycle** (On Order, In Stock, Hot Spare, Deployed, Needs Maintenance, Needs Replacement, Retired, Disposed). "Dead" maps to Retired or Disposed. |
| IP / MAC | A list of network interfaces per device, one marked primary (shown on hover) |
| Assigned user | Optional everywhere; Owner / Department field for shared and infrastructure gear |
| Location | Site > Building > Floor > Room / Rack, plus X/Y position on that floor's plan |
| Service Desk / ERP | No specific integration yet. External ID fields and CSV import/export from day one; API sync later. |
| Security | Login, roles, HTTPS, backups. Device passwords are never stored; link to a password manager instead. |
| Style | Match Rich's Claude-artifact trackers: white cards, header with status pill and summary line, purple primary buttons, tabs with count badges, stat tiles, colored status pills |
| Data ownership | The template travels between jobs; each employer's data stays with that employer |

## Platform

An installable web app (PWA) with local-first storage:

- One codebase runs in the browser and installs from the home screen on iOS, Android and Windows, which also covers the PC fallback.
- A full copy of the data (including photos and floorplans) is kept on the device, so lookups and edits work offline and sync when back online.
- Single-user to start, with export and backup. A hosted database with logins and roles is added when a team joins.

## Features (shown in the mockup)

- **Dashboard:** header summary, section tabs with counts, stat tiles (Devices, Down / issues, Maintenance due, Warranty expiring), "Needs attention" card.
- **Floorplan:** uploaded plan per floor, device pins colored by state; hover (or tap on phones) shows a large photo with hostname, IP and MAC; click opens the full entry.
- **Device list:** every column sortable.
- **Device page:** all fields grouped, interfaces table, maintenance log, ticket history.
- **Photos view:** gallery of device photos grouped by any column (section, type, location, condition, lifecycle, make, owner, criticality, year acquired), sortable within groups, adjustable tile size.
- **Search:** one header search box across every field (asset #, type, hostname, IP, MAC, user, location, section fields, tickets) that filters every view; Enter opens the top match; `/` focuses it.
- **Reports:** presets (Full inventory, Down and issues, Maintenance due, Warranty expiring, Replacement planning, Network address list, Hot spares and stock, Assigned devices by user, Custom), column picker, filters, group and sort, photos and summary options, letter-size portrait or landscape preview, print / PDF, CSV export, save as custom report.
- **Add device + QR labels:** form assigns the next asset number per section; live label preview; sizes 2×1, 1×1, 3×2 and 1.25×0.5 in; choose lines printed; QR holds the asset number (works with any scanner and the search box) or a device link; print to a Zebra label printer.

## Suggested build order (when commissioned)

1. Data model and local storage from the field dictionary; CSV import/export.
2. Device list, device page, add/edit with asset numbering and change log.
3. Dashboard, section tabs, search.
4. Floorplan upload and pin placement; photos and Photos view.
5. Reports and printing; QR label printing.
6. Offline sync, then logins and roles.
7. Phase 2: health monitoring and notifications (see `future-ideas.md`).
