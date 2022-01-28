export interface UserCreationRequest {
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    email: string;
    createdByAdmin: boolean;
    roles: string[];
}

export interface UserUpdateRequest {
  hashId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
}
