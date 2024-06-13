import { LifelikeOAuthService } from './services/oauth.service';

export function authAppInitializerFactory(authService: LifelikeOAuthService): () => Promise<void> {
  return () => authService.runInitialLoginSequence();
}
