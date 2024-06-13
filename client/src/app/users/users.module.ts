import { NgModule } from '@angular/core';

import { EffectsModule } from '@ngrx/effects';

import { SharedModule } from 'app/shared/shared.module';

import { UserSettingsComponent } from './components/user-settings.component';
import { UserProfileComponent } from './components/user-profile.component';
import { UserSecurityComponent } from './components/user-security.component';
import { UserEffects } from './store/effects';
import { TermsOfServiceDialogComponent } from './components/terms-of-service-dialog.component';
import { TermsOfServiceComponent } from './components/terms-of-service.component';
import { TermsOfServiceTextComponent } from './components/terms-of-service-text.component';
import { ChangePasswordDialogComponent } from './components/change-password-dialog.component';
import { AccountService } from './services/account.service';
import { KeycloakAccountService } from './services/keycloak-account.service';

const components = [
  UserProfileComponent,
  UserSecurityComponent,
  UserSettingsComponent,
  TermsOfServiceTextComponent,
  TermsOfServiceDialogComponent,
  ChangePasswordDialogComponent,
  TermsOfServiceComponent,
];

@NgModule({
  imports: [
    EffectsModule.forFeature([UserEffects]),
    SharedModule,
  ],
  declarations: components,
  providers: [AccountService, KeycloakAccountService],
  entryComponents: [TermsOfServiceDialogComponent, ChangePasswordDialogComponent],
  exports: components,
})
export class UserModule {
}
