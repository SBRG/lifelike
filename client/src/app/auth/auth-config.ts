import { AuthConfig } from 'angular-oauth2-oidc';

export const authConfig: AuthConfig = {
  // TODO: These should probably all be environment specific (i.e., we may not use keycloak for all environments)
  issuer: 'https://keycloak.apps.lifelike.cloud/auth/realms/master',
  clientId: 'lifelike-frontend',
  responseType: 'code',
  redirectUri: window.location.origin + '/',
  silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
  scope: 'openid profile email offline_access', // Ask offline_access to support refresh token refreshes
  useSilentRefresh: true, // Needed for Code Flow to suggest using iframe-based refreshes
  sessionChecksEnabled: true,
  showDebugInformation: true, // Also requires enabling "Verbose" level in devtools
  clearHashAfterLogin: false, // https://github.com/manfredsteyer/angular-oauth2-oidc/issues/457#issuecomment-431807040,
  nonceStateSeparator : 'semicolon' // Real semicolon gets mangled by IdentityServer's URI encoding
};
