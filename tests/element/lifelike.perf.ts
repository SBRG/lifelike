import { afterEach, By, step, TestSettings, Until } from '@flood/element'
import faker from 'faker'
import { navigateMenu } from './utils'

const baseUrl = process.env.BASE_URL || 'http://localhost:4200'
const userEmail = process.env.USER_EMAIL || 'user@lifelike.bio'
const userPassword = process.env.USER_PASSWORD || 'password'

export const settings: TestSettings = {
	loopCount: -1,
	description: 'Lifelike load tests',
	screenshotOnFailure: true,
	disableCache: false,
	clearCache: false,
	clearCookies: true,
	actionDelay: 1.5,
	stepDelay: 2.5,
	waitUntil: 'visible',
}

export default () => {
	afterEach(async browser => {
		// Take screenshot after each step
		await browser.takeScreenshot()
	})

	step('Load landing page', async b => {
		// Navigate to the landing page
		await b.visit(baseUrl)

		// Click the sign-in button
		await b.click(By.linkText('Sign in'))
	})

	step('Submit user credentials', async b => {
		// Submit login credentials
		await b.type('#email', userEmail)
		await b.type('#password', userPassword)
		await b.click('button[type=submit]')

		// Accept the terms of service dialog
		await b.click('.modal-dialog button[type=submit]')
	})

	step('Perform a random Knowledge Graph search', async b => {
		await navigateMenu('Knowledge Graph', b)

		// Fill in the search field with a random animal name and submit
		const term = faker.animal.bird()
		await b.type('app-graph-search-form input[formcontrolname=query]', term)
		await b.click('app-graph-search-form button[type=submit]')

		// Wait for the search results to load
		await b.wait(Until.elementIsVisible('app-results-summary'))
	})

	step('Load community files', async b => {
		// Load the community files page
		await b.visit(`${baseUrl}/community`)

		// Wait for the community files to load
		await b.wait(Until.elementIsVisible('app-object-list a'))
	})

	step('Click on first community file', async b => {
		// Wait for the community files to load
		await b.click('app-object-list a:first-child')

		// Wait for the loading indicator to appear
		await b.wait(Until.elementLocated('app-loading-indicator'))
	})
}
