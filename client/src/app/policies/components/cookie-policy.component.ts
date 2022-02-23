import { AfterViewInit, Component, ViewChild } from '@angular/core';

@Component({
  selector: 'app-cookie-policy',
  templateUrl: './cookie-policy.component.html',
})
export class CookiePolicyComponent implements AfterViewInit {
  @ViewChild('cookiePolicyContainer', {static: true}) cookiePolicyContainer;
  constructor() { }

  ngAfterViewInit(): void {
    // Angular automatically strips script elements from component templates, so we have to add the cookiebot script manually.
    const s = document.createElement('script');
    s.id = 'CookieDeclaration';
    s.type = 'text/javascript';
    s.src = 'https://consent.cookiebot.com/57494afb-856d-4cf0-8b86-d56bb0002688/cd.js';
    this.cookiePolicyContainer.nativeElement.appendChild(s);
  }
}
