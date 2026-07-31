// angular import
import { ChangeDetectorRef, Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-sign-in',
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss']
})
export class SignInComponent implements OnDestroy {
  private cd = inject(ChangeDetectorRef);
  private auth = inject(AuthService);
  private router = inject(Router);

  submitted = signal(false);
  error = signal('');
  info = signal('');
  showPassword = signal(false);
  isLoading = signal(false);
  rememberMe = signal(false);
  verificationStep = signal(false);
  identifier = '';
  password = '';
  otp = '';
  otpDigits: string[] = ['', '', '', ''];
  resendCooldown = signal(0);
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  onSubmit(event: Event) {
    event.preventDefault();
    this.submitted.set(true);
    this.error.set('');
    this.info.set('');

    if (!this.verificationStep()) {
      if (!this.identifier?.trim() || !this.password?.trim()) {
        this.error.set('User ID or email and password are required.');
        return;
      }

      if (this.password.trim().length < 8) {
        this.error.set('Password must be at least 8 characters.');
        return;
      }

      this.isLoading.set(true);
      this.auth.login(this.identifier.trim(), this.password).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res?.verification_required) {
            this.verificationStep.set(true);
            this.info.set(res.verification_message || 'Enter the OTP sent to your email.');
            this.password = '';
            this.otp = '';
            this.otpDigits = ['', '', '', ''];
            this.startResendCooldown(Number(res?.retry_after_seconds || 30));
            this.cd.detectChanges();
            return;
          }
          this.router.navigate(['/analytics']);
        },
        error: (e) => {
          this.isLoading.set(false);
          const message = e?.error?.detail || e?.error?.message || 'Login failed. Please check your credentials.';
          this.error.set(message);
          this.cd.detectChanges();
        }
      });
      return;
    }

    this.otp = this.otpDigits.join('').trim();
    if (!/^\d{4}$/.test(this.otp)) {
      this.error.set('Enter a valid 4-digit OTP.');
      return;
    }

    this.isLoading.set(true);
    this.auth.verifyEmail(this.identifier.trim(), this.otp.trim()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.clearResendTimer();
        this.router.navigate(['/analytics']);
      },
      error: (e) => {
        this.isLoading.set(false);
        const message = e?.error?.detail || e?.error?.message || 'Login failed. Please check your credentials.';
        this.error.set(message);
        this.cd.detectChanges();
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }

  backToLogin() {
    this.verificationStep.set(false);
    this.otp = '';
    this.otpDigits = ['', '', '', ''];
    this.info.set('');
    this.error.set('');
    this.clearResendTimer();
    this.resendCooldown.set(0);
  }

  resendOtp() {
    if (!this.identifier?.trim() || this.resendCooldown() > 0 || this.isLoading()) {
      return;
    }

    this.error.set('');
    this.info.set('');
    this.isLoading.set(true);

    this.auth.resendOtp(this.identifier.trim()).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.info.set(res?.message || 'OTP sent successfully.');
        this.startResendCooldown(Number(res?.retry_after_seconds || 30));
        this.cd.detectChanges();
      },
      error: (e) => {
        this.isLoading.set(false);
        const retryHeader = Number(e?.headers?.get?.('Retry-After') || 0);
        const retryFromMessage = Number((e?.error?.detail || '').match(/\d+/)?.[0] || 0);
        const retryAfter = retryHeader || retryFromMessage;
        if (retryAfter > 0) {
          this.startResendCooldown(retryAfter);
        }
        const message = e?.error?.detail || e?.error?.message || 'Unable to resend OTP right now.';
        this.error.set(message);
        this.cd.detectChanges();
      }
    });
  }

  private startResendCooldown(seconds: number) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    this.clearResendTimer();
    this.resendCooldown.set(safeSeconds);
    if (safeSeconds <= 0) {
      return;
    }

    this.resendTimer = setInterval(() => {
      const remaining = this.resendCooldown();
      if (remaining <= 1) {
        this.resendCooldown.set(0);
        this.clearResendTimer();
        return;
      }
      this.resendCooldown.set(remaining - 1);
    }, 1000);
  }

  private clearResendTimer() {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearResendTimer();
  }

  onOtpInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = (input.value || '').replace(/\D/g, '').slice(-1);
    this.otpDigits[index] = value;
    input.value = value;

    if (value && index < 3) {
      const next = document.getElementById(`otp-${index + 1}`) as HTMLInputElement | null;
      next?.focus();
      next?.select();
    }
  }

  onOtpKeydown(index: number, event: KeyboardEvent) {
    const key = event.key;
    if (key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`) as HTMLInputElement | null;
      prev?.focus();
      prev?.select();
      return;
    }

    if (key === 'ArrowLeft' && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`) as HTMLInputElement | null;
      prev?.focus();
      prev?.select();
    }

    if (key === 'ArrowRight' && index < 3) {
      const next = document.getElementById(`otp-${index + 1}`) as HTMLInputElement | null;
      next?.focus();
      next?.select();
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    for (let i = 0; i < 4; i++) {
      this.otpDigits[i] = pasted[i] || '';
      const el = document.getElementById(`otp-${i}`) as HTMLInputElement | null;
      if (el) {
        el.value = this.otpDigits[i];
      }
    }

    const focusIndex = Math.min(pasted.length, 4) - 1;
    const target = document.getElementById(`otp-${Math.max(0, focusIndex)}`) as HTMLInputElement | null;
    target?.focus();
    target?.select();
  }
}
