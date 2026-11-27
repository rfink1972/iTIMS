# iTIMS: Future ideas (phase 2)

## Device health monitoring

Automatically flag a device as Down when it stops responding.

- iTIMS runs on the web, so it cannot reach private addresses directly. Checks run from either:
  - a small **iTIMS probe** on an always-on machine inside the network (spare PC, VM or Raspberry Pi) that only makes outbound connections, or
  - an **existing monitoring tool** the site already runs (PRTG, Zabbix, LibreNMS, Uptime Kuma), which iTIMS reads status from.
- Per device: Monitor on/off and check method: ping, TCP port, SNMP or HTTP.
- After 3 missed checks in a row (configurable) the device turns Down automatically: Down / Issues tile, Needs attention card, red pin. It clears when the device answers again.
- New fields: Last seen, Response time, Uptime % (30 days).
- Best for fixed-address gear: network, servers, printers, PLCs, cameras. Laptops and phones usually stay off.
- Industrial network: ping only, with the OT owner's approval. Some older PLCs don't handle frequent polling well.

## Notifications

- "Down" message with device, location, time and a link; "Back up" message with how long it was down.
- Channels: email, phone push (installed app), SMS, Teams or Slack, or an automatic Service Desk ticket that is logged in the device's ticket history.
- Rules:
  - by criticality (Critical and High alert at once, Low shows on the dashboard only)
  - routing by section or owner
  - quiet hours, and a repeat alert if still down after 30 minutes
  - one grouped alert when an upstream switch fails, using the "Connected to" links
  - muted during maintenance windows
