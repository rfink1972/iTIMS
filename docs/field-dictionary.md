# iTIMS: Field Dictionary (v2)

Status: Pencil and Paper. This is the plan for the data, nothing is built yet.
Date: 2026-11-27 (v2: Infrastructure section added, open questions resolved)

**How to read this.** Req = required when saving a device. "List" means a dropdown, with its values in the Dropdown Lists section. "Auto" means the app fills it in. Every field here is sortable and filterable in list views and available to custom reports.

---

## 1. Fields shared by every device

### Identity
| Field | Type | Req | Notes |
|---|---|---|---|
| Asset Number | Auto text | Yes | Section prefix + 4 digits: EU-0001, PR-0001, NW-0001, IN-0001, SRV-0001. Assigned on save, never reused, rolls to 5 digits after 9999. |
| Section | List | Yes | End User Devices, Printers, Network Equipment, Industrial Equipment, Infrastructure. Sets the prefix and which section fields appear. |
| Device Type | List | Yes | Values depend on Section (see lists). |
| Make | Text with suggestions | Yes | Suggests values already used (Dell, HP, Cisco, Zebra, Allen-Bradley...). |
| Model | Text with suggestions | Yes | |
| Serial Number | Text | No | Unique when filled. Warns on duplicates. |
| Hostname | Text | No | Shown on hover/tap preview. |
| Asset Tag / Barcode | Auto text | Auto | Defaults to the Asset Number; QR code generated from it for label printing. Editable if a device already has a company tag. |
| Photos | Images | No | First photo is the thumbnail and the floorplan preview. |

### Network interfaces (a list; one device can have many)
| Field | Type | Req | Notes |
|---|---|---|---|
| Interface Name | Text | No | e.g. "eth0", "Mgmt", "Wi-Fi", "Port 1". |
| IP Address | IPv4/IPv6 | No | Validated format. Warns on duplicate IPs across devices. |
| MAC Address | MAC | No | Stored as AA:BB:CC:DD:EE:FF whatever the input format. Unique. |
| Addressing | List | No | Static, DHCP, DHCP Reservation. |
| VLAN | Number/text | No | |
| Connected To | Device link + port | No | e.g. NW-0003 port Gi1/0/14. Builds the "what goes down if this switch dies" view. |
| Primary | Yes/No | Auto | One per device. Its IP and MAC show on the floorplan preview and list views. |

### Status
| Field | Type | Req | Notes |
|---|---|---|---|
| Condition | List | Yes | Operational, Degraded, Down, Hardware Issue, Software Issue. Drives pin and pill color. |
| Lifecycle | List | Yes | On Order, In Stock, Hot Spare, Deployed, Needs Maintenance, Needs Replacement, Retired, Disposed. |
| Criticality | List | No | Low, Medium, High, Critical. Used to rank the "Needs attention" card. |
| Status Note | Text | No | Short reason, e.g. "Fan noise, ticket open". |

Your original eight states map like this: Operational, Down, Hardware Issue, Software Issue go to Condition. Hot Spare, Needs Replacement, Needs Maintenance go to Lifecycle. Dead becomes Lifecycle = Retired (or Disposed once it leaves the building).

### Location
| Field | Type | Req | Notes |
|---|---|---|---|
| Site | List | Yes | Managed list of sites. |
| Building | List | No | Filtered by Site. |
| Floor | List | No | Each floor can have one uploaded floorplan. |
| Room / Area | Text | No | |
| Rack / Position | Text | No | e.g. "IDF-2 Rack A, U22". |
| Floorplan Position | X/Y | Auto | Set by dragging the pin on the floorplan. |

### Ownership
| Field | Type | Req | Notes |
|---|---|---|---|
| Assigned User | Person link | No | Optional in every section, including deployed End User Devices. Mainly used for End User Devices. Person list is local now, can be imported from ERP later. |
| Owner / Department | List | No | For shared, network and industrial gear. |
| Cost Center | Text | No | |

### Purchase and support
| Field | Type | Req | Notes |
|---|---|---|---|
| Date Acquired | Date | No | |
| Vendor | Text with suggestions | No | |
| PO / Invoice Number | Text | No | |
| Cost | Currency | No | |
| Warranty Expires | Date | No | Feeds the "Warranty expiring in 90 days" tile. |
| Support Contract | Text | No | Contract number or provider. |
| End of Life / End of Support | Date | No | Feeds the replacement planning report. |
| OS / Firmware Version | Text | No | |

### Maintenance
| Field | Type | Req | Notes |
|---|---|---|---|
| Maintenance Interval | List | No | None, Monthly, Quarterly, Semi-annual, Annual, Custom days. |
| Last Maintenance Date | Auto date | Auto | Taken from the newest maintenance log entry. |
| Next Maintenance Due | Auto date | Auto | Last date + interval. Feeds the "Maintenance due" tile. |
| Maintenance Log | List of entries | No | Each entry: Date, Performed By, Type (Preventive, Repair, Upgrade, Inspection), Work Done, Parts Used, Cost, Linked Ticket. |

### Tickets and integration
| Field | Type | Req | Notes |
|---|---|---|---|
| Ticket History | List of entries | No | Each entry: Ticket Number, System, Date Opened, Date Closed, Summary, Link. Typed in now, synced later. |
| External IDs | Key/value list | No | e.g. ServiceNow sys_id, ERP asset ID. Used to match records when a sync is added. |

### Records
| Field | Type | Req | Notes |
|---|---|---|---|
| Attachments | Files | No | Manuals, config exports, invoices. |
| Notes | Long text | No | |
| Last Verified | Auto date | Auto | Set when the device is scanned in an audit walk. |
| Created / Updated | Auto | Auto | Who and when. Full change log kept per device. |

---

## 2. Section-specific fields

These appear only for devices in that section. All optional unless marked.

### End User Devices (EU-)
Device Types: Desktop, Laptop, All-in-One, Thin Client, Tablet, Phone, Handheld Scanner, Other.

| Field | Type | Notes |
|---|---|---|
| Operating System | List | Windows 11, Windows 10, macOS, iOS, iPadOS, Android, ChromeOS, Linux, Other. |
| CPU / RAM / Storage | Text | Three short fields. |
| Domain / Directory Join | List | None, AD Domain, Entra ID, Hybrid, Workgroup. |
| MDM Enrolled | Yes/No + system | e.g. Intune, Jamf, SOTI. |
| Disk Encryption | List | None, BitLocker, FileVault, Device default. |
| IMEI | Text | Phones and cellular tablets. |
| Phone Number / Carrier | Text | Phones. |
| Battery / Cradle Model | Text | Handheld scanners. |

### Printers (PR-)
Device Types: Laser, Inkjet, Label, Check, Plotter, Multifunction, Receipt, Other.

| Field | Type | Notes |
|---|---|---|
| Connection | List | Network, USB, Shared Queue, Wireless. |
| Queue Name / Print Server | Text | |
| Consumables | List of entries | Part number, type (Toner, Ink, Labels, Ribbon, Drum), color. |
| Page Count | Number + date read | |
| Label / Media Size | Text | Label printers and plotters. |
| MICR Toner | Yes/No | Check printers. |
| Secured Location | Yes/No | Check printers; flags the device in security reports. |

### Network Equipment (NW-)
Device Types: Switch, Router, Firewall, Wireless Access Point, Wireless Controller, Fiber Media Converter, Point-to-Point Radio, Other.

| Field | Type | Notes |
|---|---|---|
| Management IP | Auto | Picked from the interface marked Mgmt. |
| Port Count / PoE Budget | Number | |
| Uplinks | Text | |
| VLANs Served | Text | |
| Stack / HA Partner | Device link | |
| Config Backup Date | Date | Flags devices with no backup in 30+ days. |
| License Expires | Date | Firewalls, controllers, APs. |
| Fiber Type / Wavelength / Connector | List + text | Fiber converters: SM/MM, 850/1310/1550 nm, LC/SC/ST. |
| Link Partner | Device link | Point-to-point radios. |
| Frequency / Channel | Text | Point-to-point radios and APs. |
| SSIDs / Controller | Text + device link | Access points. |

### Industrial Equipment (IN-)
Device Types: PLC, HMI, Connected Machine, I/O Module, Industrial Switch, Drive / VFD, Other.

| Field | Type | Notes |
|---|---|---|
| Program / Project Name | Text | |
| Program Version | Text | |
| Program Backup Date | Date | Flags PLCs with no backup on file. |
| Protocols | Multi-select | Modbus TCP, EtherNet/IP, Profinet, OPC UA, Serial, Other. |
| Rack / Slot | Text | |
| Connected Machine | Device link | Links a PLC to the machine it runs. |
| Network Segment | List | OT, IT, DMZ, Isolated. |
| Integrator / Vendor Contact | Text | |
| Downtime Impact | Long text | What stops if this device stops. |

### Infrastructure (SRV-)
Device Types: Physical Server, Virtualization Host, Storage / NAS / SAN, UPS, PDU, Security Camera, NVR / Video Recorder, Badge Reader, Access Control Panel, Other.

| Field | Type | Notes |
|---|---|---|
| Server Role | Text | e.g. Domain Controller, File Server, ERP database. Servers. |
| Out-of-Band Management | Text | iDRAC / iLO / IPMI; its IP goes in the interface list as "OOB". Servers. |
| CPU / RAM / Storage / RAID | Text | Servers and storage. |
| Hosted VMs | Long text | Virtualization hosts: VM names and roles. |
| Backup Method / Last Backup | Text + date | Servers and storage. Flags anything with no backup in 7+ days. |
| Battery Install Date | Date | UPS. |
| Battery Replace Due | Auto date | UPS: install date + 4 years by default (editable). Feeds the "Maintenance due" tile. |
| Runtime / Load | Number | UPS: minutes of runtime and load % at last check. |
| Protects | Device links | UPS and PDU: the devices plugged into it. |
| Recorder / NVR | Device link | Cameras. |
| Resolution / Retention Days | Text + number | Cameras and NVRs. |
| Door / Area Controlled | Text | Badge readers. |
| Controller Panel | Device link | Badge readers: the access control panel they report to. |

---

## 3. Dropdown lists (editable in Settings)

- **Section:** End User Devices, Printers, Network Equipment, Industrial Equipment, Infrastructure
- **Condition:** Operational (green), Degraded (amber), Down (red), Hardware Issue (amber), Software Issue (amber)
- **Lifecycle:** On Order, In Stock, Hot Spare (blue), Deployed, Needs Maintenance, Needs Replacement, Retired (gray), Disposed (gray)
- **Criticality:** Low, Medium, High, Critical
- **Addressing:** Static, DHCP, DHCP Reservation
- **Maintenance Interval:** None, Monthly, Quarterly, Semi-annual, Annual, Custom
- **Maintenance Type:** Preventive, Repair, Upgrade, Inspection
- **Sites, Buildings, Floors, Departments, People:** managed lists, filled in at each new job (or imported by CSV)

## 4. Rules

- Asset Number, Serial Number and MAC Address must be unique. Duplicate IPs give a warning but are allowed (DHCP churn).
- Changing a device's Section asks for confirmation and gives it a new number in the new section; the old number is kept in its history and never reused.
- Setting Lifecycle to Disposed asks for a disposal date and method (Recycled, Sold, Returned to vendor, Destroyed) and a data-wipe confirmation.
- Every field change is written to the device's change log.

## 5. Decisions (2026-11-27)

1. Condition and Lifecycle values are approved as listed.
2. Fifth section added: Infrastructure (SRV-) for servers, storage, UPS/PDU, cameras, NVRs and badge readers.
3. Assigned User is optional everywhere, including deployed End User Devices.
