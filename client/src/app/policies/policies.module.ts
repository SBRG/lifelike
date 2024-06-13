import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { CookiePolicyComponent } from './components/cookie-policy.component';
import { CopyrightInfringementPolicyComponent } from './components/copyright-infringement-policy.component';
import { PolicyViewerComponent } from './components/policy-viewer.component';
import { PolicyHostDirective } from './directives/policy-host.directive';
import { PrivacyPolicyComponent } from './components/privacy-policy.component';
import { TermsAndConditionsComponent } from './components/terms-and-conditions.component';

const components = [
  CookiePolicyComponent,
  CopyrightInfringementPolicyComponent,
  PolicyViewerComponent,
  PrivacyPolicyComponent,
  TermsAndConditionsComponent,
];
const directives = [
  PolicyHostDirective
];

@NgModule({
  declarations: [
    ...components,
    ...directives,
  ],
  imports: [
    CommonModule,
    SharedModule
  ]
})
export class PoliciesModule { }
