import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class PermissionGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {

    const requiredPermissions = route.data['permissions'] as string[];

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // لا توجد صلاحيات مطلوبة، السماح بالوصول
    }

    const userPermissions = this.authService.getUserPermissions();

    if (!userPermissions || userPermissions.length === 0) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    const hasRequiredPermission = requiredPermissions.some(permission => userPermissions.includes(permission));

    if (!hasRequiredPermission) {
      this.router.navigate(['/unauthorized']);
      return false;
    }

    return true;
  }
}