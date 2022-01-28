import { Platform } from '@angular/cdk/platform';
import { Injectable } from '@angular/core';

import { Browsers } from 'app/interfaces/shared.interface';

@Injectable()
export class ClipboardService {
    private userHasSeenWarnings = false;

    constructor(
        private platform: Platform
    ) { }

    private getBrowser() {
        if (this.platform.ANDROID) {
            return Browsers.ANDROID;
        } else if (this.platform.BLINK) {
            return Browsers.BLINK;

        } else if (this.platform.EDGE) {
            return Browsers.EDGE;

        } else if (this.platform.FIREFOX) {
            return Browsers.FIREFOX;

        } else if (this.platform.IOS) {
            return Browsers.IOS;

        } else if (this.platform.SAFARI) {
            return Browsers.SAFARI;

        } else if (this.platform.TRIDENT) {
            return Browsers.TRIDENT;

        } else if (this.platform.WEBKIT) {
            return Browsers.WEBKIT;
        } else {
            return Browsers.UNKNOWN;
        }
    }

    /**
     * Asynchronously retrives the text content of the clipboard.
     *
     * For some browsers this may not be possible, and in such cases this function will return
     * undefined.
     */
    async readClipboard(): Promise<string> {
        const browser = this.getBrowser();

        switch (browser) {
            // TODO: We should check for CF_HTML prefix data if the browser is MS Edge. Currently, they only way to do
            // this would be to create a temp DOM element, register a paste event callback on the element, and then
            // trigger a paste event by programmatically pasting into the element. We could then potentially get the
            // CF_HTML formatted text. Obviously, this is a lot of hacky work for not a lot of payoff, so holding off on
            // the implementation for now.
            case Browsers.BLINK:
            case Browsers.EDGE: {
                // TS generates an error saying 'clipboard-read` does not exist as an option for the 'name'
                // property, but in the context of Edge and Chromium browers, it does. So, we ignore the error.
                // @ts-ignore
                const permissionsResult = await navigator.permissions.query({name: 'clipboard-read'});
                if (permissionsResult.state === 'granted' || permissionsResult.state === 'prompt') {
                    return navigator.clipboard.readText();
                }
                break;
            }
            case Browsers.FIREFOX: {
                // Currently Firefox only allows read access to the clipboard in web extensions. See the compatibility
                // documentation for readText(): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText
                if (!this.userHasSeenWarnings) {
                    alert(
                        'We would like to read some information from your clipboard, however at this time ' +
                        'Firefox does not allow us to do so. For the best experience using our app, we highly ' +
                        'recommend using Chrome or Microsoft Edge.'
                    );
                    this.userHasSeenWarnings = true;
                }
                break;
            }
            case Browsers.SAFARI: {
                if (!this.userHasSeenWarnings) {
                    alert(
                        'We would like to read some information from your clipboard. If the content of your ' +
                        'clipboard was copied from a source other than Safari, you may see a "Paste" dialog appear ' +
                        'after closing this dialog. Clicking on the "Paste" dialog will allow us to read your clipboard.'
                    );
                    this.userHasSeenWarnings = true;
                }

                try {
                    // At the time of writing, `navigator.permissions` does not exist in Safari,
                    // so here we attempt to read the the clipboard and expect the browser
                    // to handle any permissions.
                    return navigator.clipboard.readText();
                } catch (error)  {
                    // We should expect a NotAllowedError if the user does not accept the read permission
                    console.log(error);
                }
                break;
            }
            default: {
                alert(
                    'Unknown browser detected! Some features of the app may be disabled. For the best experience, ' +
                    'we recommend using Chrome or Microsoft Edge'
                );
                break;
            }
        }
    }

    /**
     * Asynchronously writes text content to the clipboard.
     *
     * This may not be possible in all browsers, and in such cases nothing is written to the clipboard.
     *
     * @param text the string to write to the user's clipboard
     */
    async writeToClipboard(text: string) {
        const browser = this.getBrowser();

        switch (browser) {
            case Browsers.BLINK:
            case Browsers.EDGE: {
                // TS generates an error saying 'clipboard-write` does not exist as an option for the 'name'
                // property, but in the context of Edge and Chromium browers, it does. So, we ignore the error.
                // @ts-ignore
                const permissionsResult = await navigator.permissions.query({name: 'clipboard-write'});
                if (permissionsResult.state === 'granted' || permissionsResult.state === 'prompt') {
                    navigator.clipboard.writeText(text);
                }
                break;
            }
            case Browsers.FIREFOX: {
                alert(
                    'We would like to write some information to your clipboard, however at this time ' +
                    'Firefox does not allow us to do so. For the best experience using our app, we highly ' +
                    'recommend using Chrome or Microsoft Edge.'
                );
                break;
            }
            case Browsers.SAFARI: {
                try {
                    // At the time of writing, `navigator.permissions` does not exist in Safari,
                    // so here we attempt to write the given text to the clipboard and expect the browser
                    // to handle any permissions.
                    navigator.clipboard.writeText(text);
                    break;
                } catch (error)  {
                    // We should expect a NotAllowedError if the user does not accept the write permission
                    console.log(error);
                }
                break;
            }
            default: {
                alert(
                    'Unknown browser detected! Some features of the app may be disabled. For the best experience, ' +
                    'we recommend using Chrome or Microsoft Edge'
                );
                break;
            }
        }
    }
}
