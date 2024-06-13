import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Subject, Observable } from 'rxjs';

import {
  AppUser,
  UserCreationRequest,
  ChangePasswordRequest,
  PrivateAppUser,
  UserUpdateData,

} from 'app/interfaces';
import { ResultList } from 'app/shared/schemas/common';

@Injectable({providedIn: 'root'})
export class AccountService implements OnDestroy {
    readonly accountApi = '/api/accounts';

    private completedSubjectsSource = new Subject<boolean>();
    private userListSource = new BehaviorSubject<AppUser[]>([]);
    readonly userList = this.userListSource.asObservable().pipe(takeUntil(this.completedSubjectsSource));

    constructor(private http: HttpClient) {}

    getUserList() {
        this.getUsers().subscribe((data: ResultList<PrivateAppUser>) => {
            this.userListSource.next(data.results);
        });
    }

    createUser(request: UserCreationRequest) {
        return this.http.post<{result: AppUser}>(
            `${this.accountApi}/`, request,
        ).pipe(map(resp => resp.result));
    }

    updateUser(updateData: UserUpdateData, hashId: string) {
        return this.http.put<{result: AppUser}>(
            `${this.accountApi}/${hashId}`, updateData);
    }

    resetPassword(email: string) {
        return this.http.get(`${this.accountApi}/${email}/reset-password`);
    }

    unlockUser(hashId: string) {
        return this.http.get(`${this.accountApi}/${hashId}/unlock-user`);
    }

    /**
     * Return list of users
     * @param hashId - optional val to query against list of users
     */
    getUsers(hashId?: string): Observable<ResultList<PrivateAppUser>> {
        if (hashId) {
            return this.http.get<ResultList<PrivateAppUser>>(`${this.accountApi}/${hashId}`);
        }
        return this.http.get<ResultList<PrivateAppUser>>(`${this.accountApi}/`);
    }

    getUserBySubject(subject: string): Observable<PrivateAppUser> {
      return this.http.get<PrivateAppUser>(`${this.accountApi}/subject/${subject}`);
    }

    currentUser(): Observable<PrivateAppUser> {
        const userState = JSON.parse(localStorage.getItem('auth')).user;
        return this.getUsers(userState.hashId).pipe(map(result => result.results[0]));
    }

    changePassword(updateRequest: ChangePasswordRequest) {
        const { hashId, newPassword, password } = updateRequest;
        return this.http.post(
            `${this.accountApi}/${hashId}/change-password`,
            {newPassword, password},
        );
    }

    ngOnDestroy() {
        this.completedSubjectsSource.next(true);
    }
}
