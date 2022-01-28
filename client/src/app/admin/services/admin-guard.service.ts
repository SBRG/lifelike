import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { AccountService } from 'app/users/services/account.service';
import { AppUser } from 'app/interfaces';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly accountService: AccountService,
              public readonly snackBar: MatSnackBar) {
  }

  canActivate(routeSnapshot: ActivatedRouteSnapshot): Observable<boolean> {
    return this.accountService.currentUser().pipe(
      map((user: AppUser) => {
        const isAdmin = user.roles.includes('admin');
        if (!isAdmin) {
          this.openSnackBar('Unauthorized', 'close');
        }
        return isAdmin;
      }),
      take(1),
    );
  }

  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {duration: 5000});
  }
}
