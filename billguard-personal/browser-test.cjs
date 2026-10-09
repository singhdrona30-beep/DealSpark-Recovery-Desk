const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  try {
    await page.goto('http://127.0.0.1:4173/billguard-personal/', { waitUntil: 'networkidle' });
    assert.match(await page.title(), /BillGuard Personal/);
    await page.locator('#billName').fill('CI Test Electricity');
    await page.locator('#amount').fill('120.50');
    await page.locator('#currency').selectOption('CAD');
    await page.locator('#dueDate').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    await page.locator('#category').selectOption('Utilities');
    await page.locator('#recurrence').selectOption('monthly');
    await page.locator('#notes').fill('Automated smoke test record');
    await page.locator('#saveBtn').click();
    await page.getByText('CI Test Electricity', { exact: true }).waitFor();
    assert.equal(await page.locator('.bill').count(), 1, 'bill is rendered');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.bill').count(), 1, 'bill persists after reload');
    await page.locator('button[data-action="paid"]').click();
    assert.equal(await page.locator('#paidTotal').textContent(), 'CA$120.50', 'paid monthly summary includes recurring payment');
    assert.equal(await page.locator('.bill .due').first().textContent().then(t => t.includes('Due')), true, 'recurring bill remains scheduled');
    await page.locator('#search').fill('no-such-bill');
    assert.equal(await page.locator('.bill').count(), 0, 'search filters bills');
    await page.locator('#search').fill('');
    const backupPromise = page.waitForEvent('download');
    await page.locator('#exportBtn').click();
    const backup = await backupPromise;
    assert.match(backup.suggestedFilename(), /billguard-personal-backup.*\.json/);
    const calendarPromise = page.waitForEvent('download');
    await page.locator('#calendarBtn').click();
    const calendar = await calendarPromise;
    assert.match(calendar.suggestedFilename(), /\.ics$/);
    console.log('BillGuard Personal browser smoke test: PASS');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
