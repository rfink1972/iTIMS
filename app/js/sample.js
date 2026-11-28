// Fictional sample devices (from the design mockup) so the app can be explored.
import { replaceAll, putBlob } from './store.js';
import { uid, addDays, todayStr } from './util.js';
import { MAINT_INTERVALS } from './schema.js';

// [asset, type, make, model, host, ip, mac, room, x, y, condition, lifecycle, user, dept, crit, acquired, warranty, eol, osFw, lastMaint, nextMaint, note, extra, tickets, ifaces]
const D = [
  ['EU-0001', 'Laptop', 'Dell', 'Latitude 7450', 'LT-JSMITH', '10.10.20.41', '8C:47:BE:12:9A:01', 'Office / Accounting', 110, 120, 'Operational', 'Deployed', 'J. Smith', 'Accounting', 'Medium', '2025-03-14', '2028-03-14', '2029-03-01', 'Windows 11 24H2', '2026-06-02', '2027-06-02', '',
    { os: 'Windows 11', directory: 'Entra ID', mdmEnrolled: true, mdmSystem: 'Intune', encryption: 'BitLocker', cpu: 'Core Ultra 7', ram: '32 GB', storage: '512 GB' }],
  ['EU-0002', 'Desktop', 'HP', 'EliteDesk 800 G9', 'PC-FRONTDESK', '10.10.20.52', '3C:52:82:7D:11:B4', 'Reception', 90, 340, 'Software Issue', 'Deployed', 'Front desk (shared)', 'Admin', 'Medium', '2023-08-21', '2026-12-20', '2028-08-01', 'Windows 11 23H2', '2026-02-10', '2027-02-10', 'Outlook profile corrupt after update',
    { os: 'Windows 11', directory: 'AD Domain', mdmEnrolled: true, mdmSystem: 'Intune', encryption: 'BitLocker', cpu: 'i5-12500', ram: '16 GB', storage: '256 GB' },
    [['INC-10482', '2026-11-25', 'Outlook will not open after Windows update', 'Open']]],
  ['EU-0003', 'Phone', 'Apple', 'iPhone 15', 'IPH-MGARCIA', '10.10.40.18', 'F4:D4:88:2E:60:7C', 'Office / Accounting', 250, 70, 'Operational', 'Deployed', 'M. Garcia', 'Operations', 'Low', '2024-10-02', '2026-10-02', '', 'iOS 19.1', '', '', '',
    { os: 'iOS', imei: '35 391811 223344 5', phoneNumber: '(555) 010-2231', carrier: 'Verizon', mdmEnrolled: true, mdmSystem: 'Intune' }],
  ['EU-0004', 'Tablet', 'Samsung', 'Galaxy Tab Active5', 'TAB-PROD01', '10.10.40.33', 'A8:9C:ED:41:0F:22', 'Production Floor', 600, 330, 'Operational', 'Deployed', 'Line 1 (shared)', 'Production', 'Medium', '2025-01-15', '2027-01-15', '', 'Android 15', '', '', '',
    { os: 'Android', mdmEnrolled: true, mdmSystem: 'Intune', encryption: 'Device default' }],
  ['EU-0005', 'Handheld Scanner', 'Zebra', 'TC58', 'SCN-SHIP03', '10.10.40.71', '00:07:4D:AA:31:9E', 'Shipping / Dock', 700, 500, 'Hardware Issue', 'Needs Maintenance', 'Shipping (shared)', 'Shipping', 'High', '2024-04-09', '2027-04-09', '', 'Android 13, LifeGuard 41', '2026-05-19', '2026-11-19', 'Trigger button sticks; battery swells',
    { os: 'Android', battery: 'BTRY-TC5X-46MA, 5-slot cradle', mdmEnrolled: true, mdmSystem: 'SOTI' },
    [['INC-10455', '2026-11-18', 'Scan trigger intermittent', 'Open']]],
  ['EU-0006', 'Laptop', 'Lenovo', 'ThinkPad T14 Gen 5', 'LT-SPARE01', 'DHCP', '98:FA:9B:C0:44:10', 'IT Closet', 400, 225, 'Operational', 'Hot Spare', '', 'IT', 'Low', '2025-09-30', '2028-09-30', '', 'Windows 11 24H2', '', '', '',
    { os: 'Windows 11', directory: 'Entra ID', mdmEnrolled: true, mdmSystem: 'Intune', encryption: 'BitLocker' }],
  ['PR-0001', 'Laser', 'HP', 'LaserJet Enterprise M611', 'PRN-OFFICE1', '10.10.30.11', '10:E7:C6:5B:2A:3F', 'Office / Accounting', 300, 200, 'Operational', 'Deployed', '', 'Admin', 'Medium', '2024-02-12', '2027-02-12', '', '', '2026-09-03', '2027-03-03', '',
    { connection: 'Network', queue: '\\\\PRINT01\\Office-Laser', consumables: 'W1470A, Toner, Black', pageCount: '84210', pageCountDate: '2026-11-20' }],
  ['PR-0002', 'Label', 'Zebra', 'ZT411', 'PRN-SHIPLBL1', '10.10.30.24', '00:07:4D:61:B8:02', 'Shipping / Dock', 900, 470, 'Operational', 'Deployed', '', 'Shipping', 'High', '2023-06-01', '2026-12-31', '', '', '2026-10-14', '2026-12-14', '',
    { connection: 'Network', mediaSize: '4 × 6 in thermal transfer', consumables: '05555BK11045, Ribbon, Black' }],
  ['PR-0003', 'Check', 'Troy', 'MICR 408', 'PRN-CHECK1', '10.10.30.31', 'B0:5C:DA:09:E1:77', 'Office / Accounting', 60, 200, 'Operational', 'Deployed', '', 'Accounting', 'High', '2022-11-08', '2025-11-08', '2027-12-31', '', '', '', 'Kept in the locked cabinet',
    { connection: 'Network', micr: true, secured: true }],
  ['PR-0004', 'Plotter', 'HP', 'DesignJet T650', 'PRN-PLOT1', '10.10.30.40', '7C:4D:8F:22:A0:5D', 'Engineering', 445, 350, 'Degraded', 'Needs Maintenance', '', 'Engineering', 'Low', '2021-05-17', '2023-05-17', '', '', '2026-03-02', '2026-09-02', 'Streaking on long prints; printhead due',
    { connection: 'Network', mediaSize: '36 in roll', consumables: 'HP 712, Ink, CMYK set' }],
  ['NW-0001', 'Firewall', 'Fortinet', 'FortiGate 100F', 'FW-MAIN', '10.10.0.1', 'E8:1C:BA:4F:00:10', 'Server Room', 385, 78, 'Operational', 'Deployed', '', 'IT', 'Critical', '2024-07-01', '2027-07-01', '', 'FortiOS 7.4.8', '2026-10-01', '2027-01-01', '',
    { licenseExpires: '2027-07-01', configBackup: '2026-11-20', portCount: '20' }, [],
    [['WAN1', '203.0.113.10', 'E8:1C:BA:4F:00:11', 'Static', ''], ['LAN', '10.10.0.1', 'E8:1C:BA:4F:00:10', 'Static', '1'], ['OT', '10.20.0.1', 'E8:1C:BA:4F:00:12', 'Static', '20']]],
  ['NW-0002', 'Switch', 'Cisco', 'Catalyst 9200-48P', 'SW-IDF2', '10.10.0.12', '70:B3:17:2C:9E:80', 'Warehouse IDF-2', 300, 470, 'Down', 'Deployed', '', 'IT', 'Critical', '2022-03-03', '2027-03-03', '', 'IOS-XE 17.12', '2026-04-11', '2027-04-11', 'No response since 11:52 AM. Warehouse APs and scanners offline.',
    { portCount: '48', poeBudget: '740', uplinks: 'Te1/1/1 to SW-CORE Gi1/0/48', vlans: '1, 20, 40', configBackup: '2026-10-30' },
    [['INC-10491', '2026-11-27', 'IDF-2 switch unreachable', 'Open'], ['CHG-2210', '2026-04-11', 'IOS-XE upgrade to 17.12', 'Closed']],
    [['Mgmt', '10.10.0.12', '70:B3:17:2C:9E:80', 'Static', '1', 'NW-0003', 'Gi1/0/48']]],
  ['NW-0003', 'Switch', 'Cisco', 'Catalyst 9300-48P', 'SW-CORE', '10.10.0.10', '70:B3:17:A1:44:00', 'Server Room', 435, 78, 'Operational', 'Deployed', '', 'IT', 'Critical', '2022-03-03', '2027-03-03', '', 'IOS-XE 17.12', '2026-04-11', '2027-04-11', '',
    { portCount: '48', poeBudget: '715', configBackup: '2026-11-20' }],
  ['NW-0004', 'Wireless Access Point', 'Ubiquiti', 'U7 Pro', 'AP-WH-01', '10.10.0.41', '9C:05:D6:3E:71:AA', 'Warehouse IDF-2', 150, 520, 'Down', 'Deployed', '', 'IT', 'High', '2025-02-20', '2027-02-20', '', '7.1.66', '', '', 'Powered by SW-IDF2 PoE',
    { ssids: 'Corp, Scanners', controller: 'SRV-0001' }, [],
    [['Ethernet', '10.10.0.41', '9C:05:D6:3E:71:AA', 'DHCP Reservation', '1', 'NW-0002', 'Gi1/0/12']]],
  ['NW-0005', 'Point-to-Point Radio', 'Ubiquiti', 'airFiber 60 LR', 'PTP-BLDG2-A', '10.10.0.60', '74:83:C2:11:F0:6B', 'Shipping / Dock', 950, 540, 'Operational', 'Deployed', '', 'IT', 'High', '2023-09-12', '2025-09-12', '', '2.6.2', '', '', 'Roof mount',
    { frequency: '60 GHz, channel 2', linkPartner: 'PTP-BLDG2-B (Building 2)' }],
  ['NW-0006', 'Fiber Media Converter', 'TP-Link', 'MC220L', 'FMC-PROD', '', '', 'Production Floor', 950, 70, 'Operational', 'Deployed', '', 'IT', 'Medium', '2021-12-01', '', '', '', '', '', '',
    { fiberType: 'Multimode (MM)', wavelength: '850 nm', connector: 'LC' }, [],
    [['Fiber', '', '', 'Static', '', 'NW-0003', 'Te1/1/2']]],
  ['IN-0001', 'PLC', 'Allen-Bradley', 'CompactLogix 5380', 'PLC-LINE1', '10.20.0.10', '00:00:BC:5A:21:E3', 'Production Floor', 640, 120, 'Operational', 'Deployed', '', 'Production', 'Critical', '2023-01-10', '', '', 'v35.011', '', '', '',
    { program: 'LINE1_MAIN', programVersion: '4.2', programBackup: '2026-08-14', protocols: ['EtherNet/IP'], segment: 'OT', downtimeImpact: 'Line 1 stops' }],
  ['IN-0002', 'Connected Machine', 'Haas', 'VF-2 CNC', 'CNC-02', '10.20.0.31', '00:1B:0F:7C:30:91', 'Production Floor', 800, 200, 'Operational', 'Needs Maintenance', '', 'Production', 'High', '2020-06-15', '', '', '', '2026-05-20', '2026-11-20', '',
    { protocols: ['Other'], segment: 'OT', integrator: 'Haas Factory Outlet' }],
  ['IN-0003', 'HMI', 'Allen-Bradley', 'PanelView Plus 7', 'HMI-LINE1', '10.20.0.11', '00:00:BC:5A:22:10', 'Production Floor', 700, 120, 'Operational', 'Deployed', '', 'Production', 'High', '2023-01-10', '', '', 'v13', '', '', '',
    { connectedMachine: 'IN-0001', segment: 'OT' }],
  ['SRV-0001', 'Virtualization Host', 'Dell', 'PowerEdge R760', 'HV-01', '10.10.1.10', 'B4:45:06:8E:12:40', 'Server Room', 400, 135, 'Operational', 'Deployed', '', 'IT', 'Critical', '2024-05-06', '2029-05-06', '', 'Hyper-V Server 2025', '2026-10-01', '2027-04-01', '',
    { serverRole: 'Hypervisor', hostedVms: 'DC01\nFS01\nERP-DB', oob: 'iDRAC', backupMethod: 'Veeam nightly', lastBackup: '2026-11-27' }, [],
    [['NIC1', '10.10.1.10', 'B4:45:06:8E:12:40', 'Static', '1'], ['OOB', '10.10.1.110', 'B4:45:06:8E:12:4F', 'Static', '1']]],
  ['SRV-0002', 'UPS', 'APC', 'Smart-UPS SRT 3000', 'UPS-SRV1', '10.10.1.20', '28:29:86:3A:7B:C1', 'Server Room', 460, 135, 'Operational', 'Needs Maintenance', '', 'IT', 'Critical', '2022-12-04', '2025-12-04', '', '', '2026-06-04', '2026-12-04', 'Battery replacement due Dec 4',
    { batteryInstall: '2022-12-04', runtime: '18', load: '41', protects: 'SRV-0001, NW-0003, NW-0001, SRV-0005' }],
  ['SRV-0003', 'Security Camera', 'Axis', 'P3265-LVE', 'CAM-DOCK1', '10.10.50.21', 'AC:CC:8E:4B:10:2D', 'Shipping / Dock', 840, 560, 'Operational', 'Deployed', '', 'Security', 'Medium', '2024-08-19', '2029-08-19', '', '', '', '', '',
    { resolution: '1080p', retentionDays: '30' }],
  ['SRV-0004', 'Badge Reader', 'HID', 'Signo 40', 'BDG-FRONT', '10.10.50.40', '00:06:8E:77:21:C9', 'Reception', 180, 385, 'Software Issue', 'Deployed', '', 'Security', 'High', '2023-03-30', '2026-12-15', '', '', '', '', 'Intermittent card read failures',
    { doorArea: 'Main entrance' }],
  ['SRV-0005', 'Storage / NAS / SAN', 'Synology', 'RS1221+', 'NAS-01', '10.10.1.30', '90:09:D0:2F:66:18', 'Server Room', 478, 78, 'Operational', 'Deployed', '', 'IT', 'High', '2023-10-10', '2026-10-10', '', 'DSM 7.3', '', '', '',
    { storage: '8 × 8 TB', raid: 'SHR-2', backupMethod: 'Offsite sync', lastBackup: '2026-11-27' }],
];

const SECT = { EU: 'EU', PR: 'PR', NW: 'NW', IN: 'IN', SRV: 'SRV' };
function interval(last, next) {
  if (!last || !next) return ['None', ''];
  const n = Math.round((new Date(next) - new Date(last)) / 86400000);
  for (const [k, v] of Object.entries(MAINT_INTERVALS)) if (v && Math.abs(v - n) <= 4) return [k, ''];
  return ['Custom', String(n)];
}

// A simple floor drawing whose rooms line up with the sample pins
const PLAN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" width="2000" height="1200" font-family="Arial,sans-serif">
<rect width="1000" height="600" fill="#fbfbfe"/>
<g fill="none" stroke="#9a98b8" stroke-width="4">
<rect x="4" y="4" width="992" height="592"/>
<path d="M340 4V420M4 260H340M4 420H996M560 4V600M340 170H560M340 280H560M470 170V280"/></g>
<g fill="#6b6990" font-size="17" font-weight="bold">
<text x="20" y="34">Office / Accounting</text><text x="20" y="290">Reception</text><text x="352" y="34">Server Room</text>
<text x="352" y="198">IT Closet</text><text x="352" y="308">Engineering</text><text x="576" y="34">Production Floor</text>
<text x="20" y="450">Warehouse IDF-2</text><text x="576" y="450">Shipping / Dock</text></g>
<g stroke="#c9c7e0" stroke-width="2" fill="#efeef8"><rect x="600" y="230" width="300" height="60" rx="6"/><rect x="620" y="480" width="40" height="110"/><rect x="760" y="480" width="40" height="110"/></g>
</svg>`;

export async function loadSample() {
  const site = 'Main Plant'; const building = 'Building 1'; const floorName = '1';
  const planId = await putBlob(new Blob([PLAN], { type: 'image/svg+xml' }), 'sample-floorplan.svg', 'floorplan');
  const now = new Date().toISOString();
  const devices = D.map(([asset, type, make, model, host, ip, mac, room, x, y, cond, life, user, dept, crit, acq, war, eol, osFw, lastM, nextM, note, extra = {}, tickets = [], ifaces]) => {
    const section = SECT[asset.split('-')[0]];
    const [mi, md] = interval(lastM, nextM);
    let interfaces;
    if (ifaces) interfaces = ifaces.map(([name, iip, imac, addressing, vlan, connectedTo = '', port = ''], i) => ({ name, ip: iip, mac: imac, addressing, vlan, connectedTo, port, primary: i === (ifaces.length > 1 && ifaces[1][1] === ip ? 1 : 0) }));
    else if (ip || mac) interfaces = [{ name: 'Ethernet', ip: ip === 'DHCP' ? '' : ip, mac, addressing: ip === 'DHCP' ? 'DHCP' : 'Static', vlan: '', connectedTo: '', port: '', primary: true }];
    else interfaces = [];
    return {
      uid: uid(), asset, section, type, make, model, serial: `SN${asset.replace('-', '')}${make.slice(0, 2).toUpperCase()}`, hostname: host, tag: '',
      photos: [], interfaces, condition: cond, lifecycle: life, criticality: crit, statusNote: note,
      site, building, floor: floorName, room, rack: '', x: x / 10, y: y / 6,
      assignedUser: user, owner: dept, costCenter: '', dateAcquired: acq, vendor: '', po: '', cost: '', warrantyExpires: war,
      supportContract: '', eol, osFw, maintInterval: mi, maintCustomDays: md,
      maintLog: lastM ? [{ date: lastM, type: 'Preventive', by: 'IT', work: 'Scheduled maintenance', parts: '', cost: '', ticket: '' }] : [],
      tickets: tickets.map(([number, opened, summary, st]) => ({ number, system: 'Service desk', opened, closed: st === 'Closed' ? opened : '', summary, link: '' })),
      externalIds: [], attachments: [], notes: '', lastVerified: '', extra, history: [{ at: now, by: 'Sample data', field: 'Created', from: '', to: asset }],
      formerAssets: [], disposal: null, created: now, updated: now, createdBy: 'Sample data',
    };
  });
  // Keep the "due" dates meaningful whatever day the sample is loaded
  const shift = Math.round((new Date(todayStr()) - new Date('2026-11-28')) / 86400000);
  if (shift > 0) for (const d of devices) for (const e of d.maintLog) e.date = addDays(e.date, shift);
  const { db } = await import('./db.js');
  const planBlob = await db.get('blobs', planId);
  await replaceAll({
    devices,
    blobs: [planBlob],
    lists: { sites: [site], buildings: [{ site, name: building }], floors: [{ id: uid(), site, building, name: floorName, plan: planId }], departments: [...new Set(devices.map((d) => d.owner))].sort(), people: ['J. Smith', 'M. Garcia'], types: {} },
    counters: {},
    settings: { orgName: 'Sample Plant (fictional)' },
    reports: [],
  });
}
