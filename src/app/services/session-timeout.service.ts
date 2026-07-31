import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private router = inject(Router);
  private auth = inject(AuthService);
  private timeoutMs = 10 * 60 * 1000; // 10 minutes
  private timer: any = null;
  private listening = false;

  start() {
    if (this.listening) return;
    this.listening = true;
    this.resetTimer();
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev => window.addEventListener(ev, this.resetTimerBound));
  }

  stop() {
    if (!this.listening) return;
    this.listening = false;
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev => window.removeEventListener(ev, this.resetTimerBound));
    this.clearTimer();
  }

  private resetTimerBound = this.resetTimer.bind(this);

  private resetTimer() {
    this.clearTimer();
    this.timer = setTimeout(() => this.onTimeout(), this.timeoutMs);
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private onTimeout() {
    try {
      // logout and route to login
      this.auth.logout();
      this.router.navigate(['/login']);
    } catch {
      // ignore
    }
  }
}
