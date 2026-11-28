// iTIMS field dictionary (v2) as data. Everything in the app (form, device page,
// list columns, filters, reports, CSV) is driven from these definitions.

export const SECTIONS = [
  { id: 'EU',  prefix: 'EU',  name: 'End User',       full: 'End User Devices',
    types: ['Desktop', 'Laptop', 'All-in-One', 'Thin Client', 'Tablet', 'Phone', 'Handheld Scanner', 'Other'] },
  { id: 'PR',  prefix: 'PR',  name: 'Printers',       full: 'Printers',
    types: ['Laser', 'Inkjet', 'Label', 'Check', 'Plotter', 'Multifunction', 'Receipt', 'Other'] },
  { id: 'NW',  prefix: 'NW',  name: 'Network',        full: 'Network Equipment',
    types: ['Switch', 'Router', 'Firewall', 'Wireless Access Point', 'Wireless Controller', 'Fiber Media Converter', 'Point-to-Point Radio', 'Other'] },
  { id: 'IN',  prefix: 'IN',  name: 'Industrial',     full: 'Industrial Equipment',
    types: ['PLC', 'HMI', 'Connected Machine', 'I/O Module', 'Industrial Switch', 'Drive / VFD', 'Other'] },
  { id: 'SRV', prefix: 'SRV', name: 'Infrastructure', full: 'Infrastructure',
    types: ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN', 'UPS', 'PDU', 'Security Camera', 'NVR / Video Recorder', 'Badge Reader', 'Access Control Panel', 'Other'] },
];
export const sectionById = (id) => SECTIONS.find((s) => s.id === id);

// Color tone for pills and pins: ok | warn | bad | info | acc | off
export const CONDITIONS = {
  'Operational': 'ok', 'Degraded': 'warn', 'Down': 'bad', 'Hardware Issue': 'warn', 'Software Issue': 'warn',
};
export const LIFECYCLES = {
  'On Order': 'off', 'In Stock': 'off', 'Hot Spare': 'info', 'Deployed': 'acc',
  'Needs Maintenance': 'warn', 'Needs Replacement': 'bad', 'Retired': 'off', 'Disposed': 'off',
};
export const CRITICALITY = ['Low', 'Medium', 'High', 'Critical'];
export const CRIT_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 };
export const ADDRESSING = ['Static', 'DHCP', 'DHCP Reservation'];
export const MAINT_INTERVALS = { 'None': 0, 'Monthly': 30, 'Quarterly': 91, 'Semi-annual': 182, 'Annual': 365, 'Custom': null };
export const MAINT_TYPES = ['Preventive', 'Repair', 'Upgrade', 'Inspection'];
export const DISPOSAL_METHODS = ['Recycled', 'Sold', 'Returned to vendor', 'Destroyed'];

// Shared fields. type: text | suggest | list | date | number | currency | bool | longtext | person | managed
// `list` names a list key (static here or a managed list in Settings).
export const SHARED_GROUPS = [
  { id: 'identity', title: 'Identity', fields: [
    { key: 'asset', label: 'Asset Number', type: 'auto' },
    { key: 'section', label: 'Section', type: 'section', req: true },
    { key: 'type', label: 'Device Type', type: 'devtype', req: true },
    { key: 'make', label: 'Make', type: 'suggest', req: true },
    { key: 'model', label: 'Model', type: 'suggest', req: true },
    { key: 'serial', label: 'Serial Number', type: 'text', mono: true },
    { key: 'hostname', label: 'Hostname', type: 'text', mono: true },
    { key: 'tag', label: 'Asset Tag / Barcode', type: 'text', mono: true, hint: 'Leave blank to use the asset number' },
  ]},
  { id: 'status', title: 'Status', fields: [
    { key: 'condition', label: 'Condition', type: 'list', list: 'condition', req: true },
    { key: 'lifecycle', label: 'Lifecycle', type: 'list', list: 'lifecycle', req: true },
    { key: 'criticality', label: 'Criticality', type: 'list', list: 'criticality' },
    { key: 'statusNote', label: 'Status Note', type: 'text', full: true },
  ]},
  { id: 'location', title: 'Location', fields: [
    { key: 'site', label: 'Site', type: 'managed', list: 'sites', req: true },
    { key: 'building', label: 'Building', type: 'managed', list: 'buildings' },
    { key: 'floor', label: 'Floor', type: 'managed', list: 'floors' },
    { key: 'room', label: 'Room / Area', type: 'suggest' },
    { key: 'rack', label: 'Rack / Position', type: 'text' },
  ]},
  { id: 'ownership', title: 'Ownership', fields: [
    { key: 'assignedUser', label: 'Assigned User', type: 'person' },
    { key: 'owner', label: 'Owner / Department', type: 'managed', list: 'departments' },
    { key: 'costCenter', label: 'Cost Center', type: 'text' },
  ]},
  { id: 'purchase', title: 'Purchase and support', fields: [
    { key: 'dateAcquired', label: 'Date Acquired', type: 'date' },
    { key: 'vendor', label: 'Vendor', type: 'suggest' },
    { key: 'po', label: 'PO / Invoice Number', type: 'text' },
    { key: 'cost', label: 'Cost', type: 'currency' },
    { key: 'warrantyExpires', label: 'Warranty Expires', type: 'date' },
    { key: 'supportContract', label: 'Support Contract', type: 'text' },
    { key: 'eol', label: 'End of Life / End of Support', type: 'date' },
    { key: 'osFw', label: 'OS / Firmware Version', type: 'text' },
  ]},
  { id: 'maintenance', title: 'Maintenance', fields: [
    { key: 'maintInterval', label: 'Maintenance Interval', type: 'list', list: 'maintInterval' },
    { key: 'maintCustomDays', label: 'Custom interval (days)', type: 'number', showIf: (d) => d.maintInterval === 'Custom' },
  ]},
  { id: 'records', title: 'Records', fields: [
    { key: 'notes', label: 'Notes', type: 'longtext', full: true },
  ]},
];

// Section-specific fields, stored under device.extra[key].
// `types` limits a field to some device types (shown for all when omitted).
export const SECTION_FIELDS = {
  EU: [
    { key: 'os', label: 'Operating System', type: 'list', options: ['Windows 11', 'Windows 10', 'macOS', 'iOS', 'iPadOS', 'Android', 'ChromeOS', 'Linux', 'Other'] },
    { key: 'cpu', label: 'CPU', type: 'text' },
    { key: 'ram', label: 'RAM', type: 'text' },
    { key: 'storage', label: 'Storage', type: 'text' },
    { key: 'directory', label: 'Domain / Directory Join', type: 'list', options: ['None', 'AD Domain', 'Entra ID', 'Hybrid', 'Workgroup'] },
    { key: 'mdmEnrolled', label: 'MDM Enrolled', type: 'bool' },
    { key: 'mdmSystem', label: 'MDM System', type: 'suggest', hint: 'e.g. Intune, Jamf, SOTI' },
    { key: 'encryption', label: 'Disk Encryption', type: 'list', options: ['None', 'BitLocker', 'FileVault', 'Device default'] },
    { key: 'imei', label: 'IMEI', type: 'text', mono: true, types: ['Phone', 'Tablet', 'Handheld Scanner'] },
    { key: 'phoneNumber', label: 'Phone Number', type: 'text', types: ['Phone', 'Tablet'] },
    { key: 'carrier', label: 'Carrier', type: 'suggest', types: ['Phone', 'Tablet'] },
    { key: 'battery', label: 'Battery / Cradle Model', type: 'text', types: ['Handheld Scanner'] },
  ],
  PR: [
    { key: 'connection', label: 'Connection', type: 'list', options: ['Network', 'USB', 'Shared Queue', 'Wireless'] },
    { key: 'queue', label: 'Queue Name / Print Server', type: 'text', mono: true },
    { key: 'consumables', label: 'Consumables', type: 'longtext', hint: 'One per line: part number, type (Toner, Ink, Labels, Ribbon, Drum), color' },
    { key: 'pageCount', label: 'Page Count', type: 'number' },
    { key: 'pageCountDate', label: 'Page Count Read On', type: 'date' },
    { key: 'mediaSize', label: 'Label / Media Size', type: 'text', types: ['Label', 'Plotter', 'Receipt'] },
    { key: 'micr', label: 'MICR Toner', type: 'bool', types: ['Check'] },
    { key: 'secured', label: 'Secured Location', type: 'bool', types: ['Check'] },
  ],
  NW: [
    { key: 'portCount', label: 'Port Count', type: 'number' },
    { key: 'poeBudget', label: 'PoE Budget (W)', type: 'number' },
    { key: 'uplinks', label: 'Uplinks', type: 'text' },
    { key: 'vlans', label: 'VLANs Served', type: 'text' },
    { key: 'haPartner', label: 'Stack / HA Partner', type: 'device' },
    { key: 'configBackup', label: 'Config Backup Date', type: 'date', hint: 'Flagged when older than 30 days' },
    { key: 'licenseExpires', label: 'License Expires', type: 'date', types: ['Firewall', 'Wireless Controller', 'Wireless Access Point', 'Other'] },
    { key: 'fiberType', label: 'Fiber Type', type: 'list', options: ['Single-mode (SM)', 'Multimode (MM)'], types: ['Fiber Media Converter'] },
    { key: 'wavelength', label: 'Wavelength', type: 'list', options: ['850 nm', '1310 nm', '1550 nm'], types: ['Fiber Media Converter'] },
    { key: 'connector', label: 'Connector', type: 'list', options: ['LC', 'SC', 'ST'], types: ['Fiber Media Converter'] },
    { key: 'linkPartner', label: 'Link Partner', type: 'device', types: ['Point-to-Point Radio'] },
    { key: 'frequency', label: 'Frequency / Channel', type: 'text', types: ['Point-to-Point Radio', 'Wireless Access Point'] },
    { key: 'ssids', label: 'SSIDs', type: 'text', types: ['Wireless Access Point', 'Wireless Controller'] },
    { key: 'controller', label: 'Controller', type: 'device', types: ['Wireless Access Point'] },
  ],
  IN: [
    { key: 'program', label: 'Program / Project Name', type: 'text' },
    { key: 'programVersion', label: 'Program Version', type: 'text' },
    { key: 'programBackup', label: 'Program Backup Date', type: 'date', hint: 'PLCs with no backup on file are flagged' },
    { key: 'protocols', label: 'Protocols', type: 'multi', options: ['Modbus TCP', 'EtherNet/IP', 'Profinet', 'OPC UA', 'Serial', 'Other'] },
    { key: 'rackSlot', label: 'Rack / Slot', type: 'text' },
    { key: 'connectedMachine', label: 'Connected Machine', type: 'device' },
    { key: 'segment', label: 'Network Segment', type: 'list', options: ['OT', 'IT', 'DMZ', 'Isolated'] },
    { key: 'integrator', label: 'Integrator / Vendor Contact', type: 'text' },
    { key: 'downtimeImpact', label: 'Downtime Impact', type: 'longtext' },
  ],
  SRV: [
    { key: 'serverRole', label: 'Server Role', type: 'text', types: ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN', 'Other'] },
    { key: 'oob', label: 'Out-of-Band Management', type: 'text', hint: 'iDRAC / iLO / IPMI. Add its IP as an "OOB" interface.', types: ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN', 'Other'] },
    { key: 'cpu', label: 'CPU', type: 'text', types: ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN', 'Other'] },
    { key: 'ram', label: 'RAM', type: 'text', types: ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN', 'Other'] },
    { key: 'storage', label: 'Storage', type: 'text', types: ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN', 'Other'] },
    { key: 'raid', label: 'RAID', type: 'text', types: ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN', 'Other'] },
    { key: 'hostedVms', label: 'Hosted VMs', type: 'longtext', types: ['Virtualization Host'] },
    { key: 'backupMethod', label: 'Backup Method', type: 'text', types: ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN', 'NVR / Video Recorder', 'Other'] },
    { key: 'lastBackup', label: 'Last Backup', type: 'date', hint: 'Flagged when older than 7 days', types: ['Physical Server', 'Virtualization Host', 'Storage / NAS / SAN', 'NVR / Video Recorder', 'Other'] },
    { key: 'batteryInstall', label: 'Battery Install Date', type: 'date', types: ['UPS'] },
    { key: 'batteryDue', label: 'Battery Replace Due', type: 'date', hint: 'Blank = install date + 4 years', types: ['UPS'] },
    { key: 'runtime', label: 'Runtime (minutes)', type: 'number', types: ['UPS'] },
    { key: 'load', label: 'Load %', type: 'number', types: ['UPS'] },
    { key: 'protects', label: 'Protects', type: 'devices', hint: 'Asset numbers, comma separated', types: ['UPS', 'PDU'] },
    { key: 'recorder', label: 'Recorder / NVR', type: 'device', types: ['Security Camera'] },
    { key: 'resolution', label: 'Resolution', type: 'text', types: ['Security Camera', 'NVR / Video Recorder'] },
    { key: 'retentionDays', label: 'Retention Days', type: 'number', types: ['Security Camera', 'NVR / Video Recorder'] },
    { key: 'doorArea', label: 'Door / Area Controlled', type: 'text', types: ['Badge Reader'] },
    { key: 'panel', label: 'Controller Panel', type: 'device', types: ['Badge Reader'] },
  ],
};

export const STATIC_LISTS = {
  condition: Object.keys(CONDITIONS),
  lifecycle: Object.keys(LIFECYCLES),
  criticality: CRITICALITY,
  maintInterval: Object.keys(MAINT_INTERVALS),
};

// Fields every list view, filter, report and CSV can use. Computed ones are read-only.
// get(d, ctx) returns a display string; sortKey optional.
export function allColumns() {
  const cols = [];
  const add = (c) => cols.push(c);
  add({ key: 'asset', label: 'Asset #', group: 'Identity' });
  add({ key: 'sectionName', label: 'Section', group: 'Identity', get: (d) => sectionById(d.section)?.full || d.section });
  for (const g of SHARED_GROUPS) {
    for (const f of g.fields) {
      if (['asset', 'section', 'maintCustomDays'].includes(f.key)) continue;
      add({ key: f.key, label: f.label, group: g.title, type: f.type });
    }
  }
  add({ key: 'ip', label: 'Primary IP', group: 'Network', computed: true, mono: true });
  add({ key: 'mac', label: 'Primary MAC', group: 'Network', computed: true, mono: true });
  add({ key: 'allIps', label: 'All IPs', group: 'Network', computed: true, mono: true });
  add({ key: 'vlan', label: 'Primary VLAN', group: 'Network', computed: true });
  add({ key: 'lastMaint', label: 'Last Maintenance', group: 'Maintenance', computed: true, type: 'date' });
  add({ key: 'nextMaint', label: 'Next Maintenance Due', group: 'Maintenance', computed: true, type: 'date' });
  add({ key: 'openTickets', label: 'Open Tickets', group: 'Tickets', computed: true });
  add({ key: 'lastVerified', label: 'Last Verified', group: 'Records', type: 'date' });
  add({ key: 'created', label: 'Created', group: 'Records', type: 'datetime' });
  add({ key: 'updated', label: 'Updated', group: 'Records', type: 'datetime' });
  add({ key: 'yearAcquired', label: 'Year Acquired', group: 'Purchase and support', computed: true });
  for (const s of SECTIONS) {
    for (const f of SECTION_FIELDS[s.id]) {
      const k = 'x.' + f.key;
      const existing = cols.find((c) => c.key === k);
      if (existing) { existing.sections.push(s.id); continue; }
      cols.push({ key: k, label: f.label, group: 'Section fields', type: f.type, sections: [s.id] });
    }
  }
  return cols;
}

export const DEFAULT_LIST_COLUMNS = ['asset', 'type', 'hostname', 'ip', 'mac', 'room', 'assignedUser', 'condition', 'lifecycle', 'nextMaint'];

// Placeholder line drawings used when a device has no photo yet (from the mockup)
export const ICONS = {
  laptop: '<rect x="5" y="6" width="14" height="9" rx="1"/><path d="M3 18h18l-1.5-3h-15z"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  tablet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M11 18h2"/>',
  scanner: '<path d="M8 3h8v9l2 2v7H6v-7l2-2z"/><path d="M10 6h4M9 16h6"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>',
  label: '<rect x="3" y="7" width="18" height="11" rx="1.5"/><path d="M8 7V4h8v3M8 18v3h8v-3M6 11h3"/>',
  plotter: '<rect x="2" y="7" width="20" height="7" rx="1.5"/><path d="M5 14v7M19 14v7M6 10h12"/>',
  switch: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M5 12h1M8 12h1M11 12h1M14 12h1M17 12h2"/>',
  router: '<rect x="3" y="12" width="18" height="7" rx="1.5"/><path d="M7 12V6M17 12V6M7 15.5h.01M10 15.5h.01"/>',
  firewall: '<path d="M3 5h18v14H3zM3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M9 14.3V19"/>',
  ap: '<ellipse cx="12" cy="15" rx="8" ry="3.5"/><path d="M8.5 8.5a5 5 0 0 1 7 0M6 6a8.5 8.5 0 0 1 12 0"/>',
  radio: '<path d="M12 21V11"/><circle cx="12" cy="8" r="3"/><path d="M6 4a8 8 0 0 0 0 8M18 4a8 8 0 0 1 0 8M8 21h8"/>',
  fiber: '<rect x="6" y="7" width="12" height="10" rx="1.5"/><path d="M2 10h4M2 14h4M18 12h4"/>',
  plc: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 5v14M11 5v14M15 5v14M4.5 8h1M8.5 8h1M12.5 8h1M16.5 8h3"/>',
  hmi: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><rect x="6" y="7" width="7" height="7"/><path d="M15.5 8h3M15.5 11h3M9 21h6M12 17v4"/>',
  machine: '<rect x="3" y="6" width="18" height="13" rx="1"/><path d="M3 10h18M8 13h3v6M14 13h4v3h-4z"/>',
  server: '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="10" width="18" height="5" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/><path d="M6 6.5h.01M6 12.5h.01M6 18h.01"/>',
  nas: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 7h8M8 10h8M8 13h8M8 17h.01"/>',
  ups: '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M12.8 7l-2.6 4.5h3.6L11.2 16"/>',
  camera: '<path d="M3 8h13l4-2v8l-4-2H3z"/><path d="M8 12v5M5 17h6"/>',
  badge: '<rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M10 15h4M10 17.5h4"/>',
};
const TYPE_ICON = {
  'Desktop': 'desktop', 'Laptop': 'laptop', 'All-in-One': 'desktop', 'Thin Client': 'desktop', 'Tablet': 'tablet', 'Phone': 'phone', 'Handheld Scanner': 'scanner',
  'Laser': 'printer', 'Inkjet': 'printer', 'Label': 'label', 'Check': 'printer', 'Plotter': 'plotter', 'Multifunction': 'printer', 'Receipt': 'label',
  'Switch': 'switch', 'Router': 'router', 'Firewall': 'firewall', 'Wireless Access Point': 'ap', 'Wireless Controller': 'server', 'Fiber Media Converter': 'fiber', 'Point-to-Point Radio': 'radio',
  'PLC': 'plc', 'HMI': 'hmi', 'Connected Machine': 'machine', 'I/O Module': 'plc', 'Industrial Switch': 'switch', 'Drive / VFD': 'plc',
  'Physical Server': 'server', 'Virtualization Host': 'server', 'Storage / NAS / SAN': 'nas', 'UPS': 'ups', 'PDU': 'ups', 'Security Camera': 'camera', 'NVR / Video Recorder': 'nas', 'Badge Reader': 'badge', 'Access Control Panel': 'badge',
};
const SECTION_ICON = { EU: 'desktop', PR: 'printer', NW: 'switch', IN: 'plc', SRV: 'server' };
export const iconKey = (d) => TYPE_ICON[d.type] || SECTION_ICON[d.section] || 'desktop';
