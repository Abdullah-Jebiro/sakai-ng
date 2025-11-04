import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PaginatedListOfUserDetail, RegisterUserCommand, RegisterUserResponse, SearchUserRequest, ToggleUserStatusCommand, TokenGenerationUsingUsernameCommand, TokensClient, UpdateUserCommand, UserDetail, UsersClient } from './api-client';

export interface UserToken {
    token: string;
    tokenExpiryTime: string;
    refreshToken: string;
    refreshTokenExpiryTime: string;
    roles: string[];
    id?: string;
    userName?: string;
    fullName?: string;
    permissions?: string[];
    departmentId?: number;
    departmentName?: string;
    isActive?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private currentUserSubject = new BehaviorSubject<UserToken | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
    public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

    private usernameSubject = new BehaviorSubject<string | null>(this.extractUsernameFromToken());
    public username$ = this.usernameSubject.asObservable();

    // For testing permissions
    private testPermissions: string[] | null = null;

    constructor(
        private usersClient: UsersClient,
        private tokensClient: TokensClient,
        private router: Router
    ) {
        // تحميل البيانات من localStorage عند التهيئة
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                this.currentUserSubject.next(user);
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                localStorage.removeItem('currentUser');
            }
        }
    }

    login(request: TokenGenerationUsingUsernameCommand): Observable<any> {
        return this.tokensClient.tokenGenerationUsingUsernameCommand(request).pipe(
            tap((response: any) => {
                if (response.token) {
                    // إذا كان الرد يحتوي على token كامل مع الأدوار
                    if (response.roles) {
                        const userData: UserToken = {
                            token: response.token,
                            tokenExpiryTime: response.tokenExpiryTime || response.exp,
                            refreshToken: response.refreshToken || '',
                            refreshTokenExpiryTime: response.refreshTokenExpiryTime || '',
                            roles: response.roles
                        };
                        this.setToken(response.token);
                        this.usersClient.getMeEndpoint().subscribe({
                            next: (userInfo) => {
                                const fullUserData: UserToken = {
                                    ...userData,
                                    id: userInfo.id,
                                    userName: userInfo.userName,
                                    fullName: userInfo.fullName,
                                    permissions: userInfo.permissions,
                                    departmentId: userInfo.departmentId,
                                    departmentName: userInfo.departmentName,
                                    isActive: userInfo.isActive
                                };
                                this.setUserData(fullUserData);
                            },
                            error: (error) => {
                                console.error('Error fetching user info:', error);
                                // في حالة الخطأ، استخدم البيانات الأساسية
                                this.setUserData(userData);
                            }
                        });
                    } else {
                        // الطريقة القديمة للتوافق
                        this.setToken(response.token);
                    }
                }
            })
        );
    }

    setUserData(userData: UserToken): void {
        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('auth_token', userData.token); // للتوافق مع الكود الموجود
        this.currentUserSubject.next(userData);
        this.isAuthenticatedSubject.next(true);
        this.usernameSubject.next(this.extractUsernameFromToken());
    }

    getUserRoles(): string[] {
        const currentUser = this.currentUserSubject.value;
        return currentUser?.roles || [];
    }

    hasRole(role: string): boolean {
        const roles = this.getUserRoles();
        return roles.includes(role);
    }

    getUserPermissions(): string[] {
        return this.testPermissions || this.currentUserSubject.value?.permissions || [];
    }

    setTestPermissions(permissions: string[]): void {
        this.testPermissions = permissions;
        // Trigger update to refresh UI
        this.currentUserSubject.next(this.currentUserSubject.value);
    }

    clearTestPermissions(): void {
        this.testPermissions = null;
        this.currentUserSubject.next(this.currentUserSubject.value);
    }

    hasPermission(permission: string): boolean {
        const permissions = this.getUserPermissions();
        return permissions.includes(permission);
    }

    hasAnyPermission(permissions: string[]): boolean {
        const userPermissions = this.getUserPermissions();
        return permissions.some((permission) => userPermissions.includes(permission));
    }

    getCurrentUser(): UserToken | null {
        return this.currentUserSubject.value;
    }

    logout(): void {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
        localStorage.clear();
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        this.usernameSubject.next(null);
        this.router.navigate(['/auth/login']);
    }

    setToken(token: string): void {
        localStorage.setItem('auth_token', token);
        this.isAuthenticatedSubject.next(true);
        this.usernameSubject.next(this.extractUsernameFromToken());
        // لا نحتاج لتحديث currentUser هنا لأن setUserData تتعامل مع ذلك
    }

    getToken(): string | null {
        return localStorage.getItem('auth_token');
    }

    isAuthenticated(): boolean {
        const currentUser = this.currentUserSubject.value;
        if (!currentUser) return this.hasToken();

        // التحقق من انتهاء صلاحية التوكن
        const expiryTime = new Date(currentUser.tokenExpiryTime);
        return expiryTime > new Date();
    }

    createUser(request: RegisterUserCommand): Observable<RegisterUserResponse> {
        return this.usersClient.registerUserEndpoint(request).pipe(map((response) => response));
    }

    searchUsersWithPagination(criteria: SearchUserRequest): Observable<PaginatedListOfUserDetail> {
        return this.usersClient.searchUsersWithPaginationEndpoint(criteria).pipe(map((response) => response));
    }


    toggleStatusAsync(id: string, command: ToggleUserStatusCommand): Observable<void> {
        return this.usersClient.toggleUserStatusEndpoint(id, command).pipe(map((response) => response));
    }

    private hasToken(): boolean {
        const token = localStorage.getItem('auth_token');
        if (!token) return false;

        // Optional: Check if token is expired
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            return payload.exp > currentTime;
        } catch {
            // If token parsing fails, consider it invalid
            return false;
        }
    }

    private extractUsernameFromToken(): string | null {
        const token = localStorage.getItem('auth_token');
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1] || ''));
            return payload.username || payload.unique_name || payload.sub || payload.name || null;
        } catch {
            return null;
        }
    }
}
