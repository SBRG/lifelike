interface KeycloakUserProfileMetadata {
  attributes: {[key: string]: any}[];
}

export interface KeycloakUserData {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  userProfileMetadata: KeycloakUserProfileMetadata;
  attributes: {[key: string]: any[]};
}
