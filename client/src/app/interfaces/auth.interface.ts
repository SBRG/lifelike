export interface AppUser {
  /**
   * @deprecated
   */
  id: number;
  hashId: string;
  /**
   * @deprecated
   */
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  locked?: boolean;

  /**
   * @deprecated
   */
  roles: string[];
}

/** Same as 'AppUser', but with a different name. This is done to help
 * deprecate parts of the code that should not be revealing sensitive
 * information vs parts where it's okay such as the 'admin views'.
 */
export interface PrivateAppUser {
  id: number;
  hashId: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  resetPassword?: boolean;
  locked?: boolean;
  roles: string[];
}

export type User = Pick<AppUser, 'id' | 'username'>;

export interface ChangePasswordRequest {
  hashId: string;
  password: string;
  newPassword: string;
}

export interface Credential {
  email: string;
  password: string;
}

export interface JWTToken {
    sub: string;
    iat: string;
    exp: string;
    tokenType: string;
    token: string;
}

export interface JWTTokenResponse {
    accessToken: JWTToken;
    refreshToken: JWTToken;
    user: PrivateAppUser;
}
