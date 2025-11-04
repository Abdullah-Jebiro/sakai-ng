import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UsersClient, SearchUserRequest, PaginatedListOfUserDetail, ToggleUserStatusCommand, AssignUserRoleCommand, UserRoleDetail, UserDetail, RegisterUserCommand, RegisterUserResponse, RolesClient, RoleDto, UpdateUserCommand } from './api-client';

@Injectable({ providedIn: 'root' })
export class UsersService {
    constructor(
        private usersClient: UsersClient,
        private rolesClient: RolesClient
    ) {}

    //this endpoint not get rolename but used in users list
    searchUsers(request: SearchUserRequest): Observable<PaginatedListOfUserDetail> {
        return this.usersClient.searchUsersWithPaginationEndpoint(request);
    }

    toggleUserStatus(userId: string, cmd: ToggleUserStatusCommand): Observable<void> {
        return this.usersClient.toggleUserStatusEndpoint(userId, cmd);
    }

    addRoleToUser(userId: string, roleName: string): Observable<void> {
        return this.usersClient.addRoleToUserEndpoint(userId, roleName);
    }

    assignRolesToUser(userId: string, cmd: AssignUserRoleCommand): Observable<void> {
        return this.usersClient.assignRolesToUserEndpoint(cmd, userId);
    }

    removeRoleFromUser(userId: string, roleName: string): Observable<void> {
        return this.usersClient.deleteRoleToUserEndpoint(userId, roleName);
    }

    getUserRoles(userId: string): Observable<UserRoleDetail[]> {
        return this.usersClient.getUserRolesEndpoint(userId);
    }

    getUser(userId: string): Observable<UserDetail> {
        return this.usersClient.getUserEndpoint(userId);
    }

    registerUserEndpoint(command: RegisterUserCommand): Observable<RegisterUserResponse> {
        return this.usersClient.registerUserEndpoint(command);
    }

    updateUser(command: UpdateUserCommand | any): Observable<string> {
        // Accept a plain object too so extra fields like isManager get serialized
        return this.usersClient.updateUserEndpoint(command as any);
    }


    



}
