import { APP_INITIALIZER, ModuleWithProviders, NgModule, Optional, SkipSelf } from '@angular/core';

import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';

import { SharedModule } from 'app/shared/shared.module';

import { AuthenticationService } from './services/authentication.service';
import { LoginComponent } from './components/login.component';
import { ResetPasswordDialogComponent } from './components/reset-password-dialog.component';
import { reducer } from './store/reducer';
import { AuthEffects } from './store/effects';
import { LifelikeAuthGuard } from './guards/auth-guard.service';
import { LoginGuard } from './guards/login-guard.service';
import { LifelikeOAuthService } from './services/oauth.service';
import { authAppInitializerFactory } from './auth-app-initializer.factory';
import { AuthConfig, OAuthModule, OAuthModuleConfig, OAuthStorage } from 'angular-oauth2-oidc';
import { authConfig } from './auth-config';
import { authModuleConfig } from './auth-module-config';
import { environment } from '../../environments/environment';

const components = [
    LoginComponent,
    ResetPasswordDialogComponent
];

// We need a factory since localStorage is not available at AOT build time
export function storageFactory(): OAuthStorage {
  return localStorage;
}

@NgModule({
    imports: [
        OAuthModule.forRoot(),
        EffectsModule.forFeature([AuthEffects]),
        StoreModule.forFeature('auth', reducer),
        SharedModule,
    ],
    declarations: components,
    providers: [
        LifelikeAuthGuard,
        AuthenticationService,
        LifelikeOAuthService,
        LoginGuard,
    ],
    exports: components,
    entryComponents: [ResetPasswordDialogComponent]
})
export class LifelikeAuthModule {
  constructor(@Optional() @SkipSelf() parentModule: LifelikeAuthModule) {
    if (parentModule) {
      throw new Error('LifelikeAuthModule is already loaded. Import it in the AppModule only');
    }
  }

  static forRoot(): ModuleWithProviders<LifelikeAuthModule> {
    // Note: module `forRoot` methods must consist of only a single return statement
    return {
      ngModule: LifelikeAuthModule,
      providers: environment.oauthEnabled
        ? [
            { provide: APP_INITIALIZER, useFactory: authAppInitializerFactory, deps: [LifelikeOAuthService], multi: true },
            { provide: AuthConfig, useValue: authConfig },
            { provide: OAuthModuleConfig, useValue: authModuleConfig },
            { provide: OAuthStorage, useFactory: storageFactory }]
        : []
    };
  }
}
