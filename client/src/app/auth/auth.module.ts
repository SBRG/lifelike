import { NgModule } from '@angular/core';

import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';

import { SharedModule } from 'app/shared/shared.module';

import { AuthenticationService } from './services/authentication.service';
import { LoginComponent } from './components/login.component';
import { reducer } from './store/reducer';
import { AuthEffects } from './store/effects';
import { AuthGuard } from './guards/auth-guard.service';
import { LoginGuard } from './guards/login-guard.service';
import { ResetPasswordDialogComponent } from './components/reset-password-dialog.component';

const components = [
    LoginComponent,
    ResetPasswordDialogComponent
];

@NgModule({
    imports: [
        EffectsModule.forFeature([AuthEffects]),
        StoreModule.forFeature('auth', reducer),
        SharedModule,
    ],
    declarations: components,
    providers: [
        AuthGuard,
        AuthenticationService,
        LoginGuard,
    ],
    exports: components,
    entryComponents: [ResetPasswordDialogComponent]
})
export class AuthModule {}
