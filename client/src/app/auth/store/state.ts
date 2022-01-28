import { AppUser } from 'app/interfaces';

export interface State {
    loggedIn: boolean;

    // user may also be anonymous (hence not null) if we need to track
    // it that way
    user: AppUser | null;

    // in case of an auth guard, the user may be asked to authenticate
    // first, after which the original requested url should be
    // presented
    targetUrl: string | '/';
}

export const initialState: State = {
    loggedIn: false,
    user: null,
    targetUrl: '/',
};
