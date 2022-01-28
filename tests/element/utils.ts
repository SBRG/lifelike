import { Browser } from '@flood/element'

export const navigateMenu = (tooltip: string, browser: Browser) => {
	return browser.click(`[ngbtooltip="${tooltip}"`)
}
