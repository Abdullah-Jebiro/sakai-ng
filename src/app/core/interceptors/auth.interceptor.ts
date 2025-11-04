import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    constructor(private router: Router) {}

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        // Get token from localStorage
        const token = localStorage.getItem('auth_token');
        // Clone request and add Authorization header if token exists
        let authRequest = request;
        if (token) {
            authRequest = request.clone({
                setHeaders: {
                    Authorization: `Bearer ${token}`
                }
            });
        }

        // Handle the request and catch any authentication errors
        return next.handle(authRequest).pipe(
            catchError((error: HttpErrorResponse) => {
                // If 401 Unauthorized, redirect to login
                if (error.status === 401) {
                    localStorage.removeItem('auth_token');
                    this.router.navigate(['/auth/login']);
                }
                
                // If 403 Forbidden, show access denied message
                if (error.status === 403) {
                    console.warn('Access denied - insufficient permissions');
                    // Could show a toast message here
                }

                return throwError(() => error);
            })
        );
    }
}