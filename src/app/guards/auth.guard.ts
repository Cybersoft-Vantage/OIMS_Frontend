import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated) {
    router.navigate(['/login']);
    return false;
  }

  const allowedRoles = ((route?.data as any)?.roles as string[] | undefined) ?? [];
  if (allowedRoles.length > 0) {
    const userRole = (auth.role || '').toLowerCase();
    const allowed = allowedRoles.some((role) => role.toLowerCase() === userRole);
    if (!allowed) {
      router.navigate(['/analytics']);
      return false;
    }
  }

  return true;
};
