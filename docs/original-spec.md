# Device Database Specs (original)

Copied from Rich's Google Doc "Device Database Specs" on 2026-11-27. Rich's words, lightly formatted.

Pencil and Paper Mode. This is what I've come up with so far, I will iterate further as I see how the build out comes together. Please evaluate and suggest any additional features, fields or changes that an IT database might find useful.

## Creation of Database

- Device Database shall be portable, accessible on the Web, Android and iOS via app or shortcut.
- MAY need to pull/sync data with Service Desk/ERP software, type unknown as of now.
- Customizable reports.
- Full dashboard view done in style of my other trackers.
- Each object should be assigned an asset # starting at 0001.
- Devices should be fully sortable in all views.

## Database Layout: Separate Sections

- **End User Devices:** PCs, Tablets, Phones, Handheld Scanners
- **Printers:** Laser Printers, Label Printers, Check Printers, Plotters
- **Network Equipment:** Switches, Routers, Firewalls, Fiber Converters, Point to Point Broadcast/Receivers, APs
- **Industrial Equipment:** PLCs, Connected Machines

## Dashboard Layout

- Buttons on dashboard for each Section.
- I will upload a floorplan; will need button to access and view.
- I will eventually upload a picture of each device.
- Devices should be placeable on an overlay of the floor plan.
- When hovering over each device, the image should blow up with the Host name, IP address, and MAC address underneath.
- Clicking on device icon or picture should bring up database entry with all information laid out below.

## Device View Properties

- Device Type: dropdown
- Make: dropdown or text entry
- Model: dropdown or text entry
- Host Name: text box
- IP address: text box
- MAC Address: text box
- Location: dropdown or text entry
- Assigned User: ?? (may be imported from ERP/Service Desk software)
- State: dropdown: Operational, Down, Hardware Issue, Software Issue, Hot Spare, Dead, Needs Replacement, Needs Maintenance
- Ticket # History
- Date Acquired
- Last Maintenance Date
- Maintenance History
