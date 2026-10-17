// Takes store-listing screenshots of the built app with a synthetic patient.
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://localhost:4173/'
const out = process.env.OUT ?? 'screenshots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` })
const tab = (name) => page.getByRole('tab', { name, exact: true }).click()

await page.goto(base)
await page.getByRole('heading', { name: 'Connect to a provider' }).scrollIntoViewIfNeeded()
await page.evaluate(() => window.scrollTo(0, 0))
await shot('01-connect-to-a-provider')

await page.getByRole('button', { name: 'Show the patients' }).click()
await page.getByRole('button', { name: 'Load Maximus Decimus Meridius' }).click()
await page.getByText(/Loaded Maximus Decimus Meridius/).waitFor({ timeout: 60000 })

await tab('My health')
await page.waitForTimeout(1500)
await shot('02-my-health')

await tab('Clinical view')
await page.waitForTimeout(1500)
await shot('03-clinical-view')

await tab('Compare plans')
await page.getByRole('button', { name: /Load real 2026 plans/ }).click()
await page.waitForTimeout(4000)
await shot('04-compare-plans')

await tab('Medical RTB')
await page.getByLabel(/Example plan/).selectOption({ label: 'Aetna Medicare Select Extra (HMO-POS), 2027' })
await page.getByRole('heading', { name: /Aetna Medicare Select Extra/ }).waitFor({ timeout: 60000 })
await page.getByRole('heading', { name: /Aetna Medicare Select Extra/ }).scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
await shot('05-plan-benefits')

await tab('Share & Export')
await page.waitForTimeout(1500)
await shot('06-share')

await browser.close()
