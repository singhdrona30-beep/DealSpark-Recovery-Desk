# BillGuard Personal (early-access PWA)

A phone-friendly household bill tracker adapted from DealSpark's BillGuard concept.

## Included
- Add, edit, search, filter, and delete household bills.
- Due-this-month, next-seven-days, overdue, and paid-this-month summaries.
- Currency labels (CAD, USD, GYD, GBP, EUR).
- One-time and recurring due dates; recurring bills advance when marked paid.
- JSON backup and restore, CSV is not needed for restore; due-date calendar export (.ics).
- Responsive layout and offline-capable PWA shell for Add to Home Screen.

## Honest current limits
- This build stores records in the browser on the current device only. It has no account, cloud sync, bank connection, bill-payment function, or automatic push notifications.
- Calendar export creates an .ics file; users import it into their calendar and configure any reminders there.
- No checkout/payment is wired. This is an early-access product preview, not yet a paid subscription.
- Data may be lost if browser storage is cleared. Use Back up data before changing devices.

## Test
Open `index.html` through a local HTTP server or the deployed GitHub Pages subfolder. Add a bill, reload, mark it paid, verify recurring dates, search/filter, export/restore JSON, and export calendar dates.
