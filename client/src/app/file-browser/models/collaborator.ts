import { AppUser } from 'app/interfaces';

import { CollaboratorData } from '../schema';

export class Collaborator {
  user: AppUser;
  roleName: string;

  get roleDescription(): string {
    switch (this.roleName) {
      case 'project-admin':
        return 'Can edit and invite';
      case 'project-write':
        return 'Can edit';
      case 'project-read':
        return 'Can view';
      default:
        return this.roleName;
    }
  }

  update(data: CollaboratorData): Collaborator {
    this.user = data.user;
    this.roleName = data.roleName;
    return this;
  }
}
