import { Injectable, Optional } from '@angular/core';
import { ConfirmModalService } from './confirm-modal.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private containerId = 'app-toast-container';
  private initialized = false;
  constructor(@Optional() private confirmService?: ConfirmModalService) {}

  private ensureContainer() {
    if (this.initialized) return;
    this.initialized = true;
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.style.position = 'fixed';
      container.style.top = '1rem';
      container.style.right = '1rem';
      container.style.zIndex = '99999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '0.5rem';
      document.body.appendChild(container);
    }

    // inject minimal styles if not present
    if (!document.getElementById('app-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'app-toast-styles';
      style.innerHTML = `
        #${this.containerId} { pointer-events: none; }
        .app-toast { display:flex; align-items:center; gap:0.75rem; padding:0.6rem 1rem; border-radius:10px; color:#fff; box-shadow:0 6px 24px rgba(0,0,0,0.12); min-width:220px; max-width:520px; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial; pointer-events:auto; overflow:hidden; }
        .app-toast .toast-icon { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(255,255,255,0.12); flex:0 0 36px; }
        .app-toast .toast-message { flex:1 1 auto; font-size:0.95rem; }
        .app-toast .toast-close { margin-left:0.5rem; background:transparent; border:none; color:rgba(255,255,255,0.9); font-size:1.1rem; cursor:pointer; }
        .app-toast-success { background: linear-gradient(180deg,#28a745,#198754); }
        .app-toast-error { background: linear-gradient(180deg,#e55353,#dc3545); }
        .app-toast-info { background: linear-gradient(180deg,#4ea1ff,#0d6efd); }
        .app-toast-warn { background: linear-gradient(180deg,#f6c26b,#f0ad4e); color:#222; }
        .app-toast.fade-out { opacity:0; transform:translateY(-6px); transition:opacity 250ms ease, transform 250ms ease; }
      `;
      document.head.appendChild(style);
    }
  }

  private show(message: string, cls: string, timeout = 4000) {
    try {
      this.ensureContainer();
      const container = document.getElementById(this.containerId)!;
      const el = document.createElement('div');
      el.className = `app-toast ${cls}`;

      const icon = document.createElement('span');
      icon.className = 'toast-icon';
      // simple check SVG for success, fallback dot for others
      if (cls.includes('success')) {
        icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
      } else if (cls.includes('error')) {
        icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      } else {
        icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>';
      }

      const msg = document.createElement('div');
      msg.className = 'toast-message';
      msg.textContent = message;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'toast-close';
      closeBtn.innerHTML = '✕';
      closeBtn.onclick = () => { el.remove(); };

      el.appendChild(icon);
      el.appendChild(msg);
      el.appendChild(closeBtn);

      container.appendChild(el);

      const removeFn = () => {
        el.classList.add('fade-out');
        setTimeout(() => el.remove(), 260);
      };

      if (timeout && timeout > 0) {
        setTimeout(removeFn, timeout);
      }
    } catch (e) {
      // fallback
      console.log('Notification:', message);
    }
  }

  success(message: string, timeout?: number) {
    this.show(message, 'app-toast-success', timeout || 3000);
  }

  error(message: string, timeout?: number) {
    this.show(message, 'app-toast-error', timeout || 5000);
  }

  info(message: string, timeout?: number) {
    this.show(message, 'app-toast-info', timeout || 3000);
  }

  warn(message: string, timeout?: number) {
    this.show(message, 'app-toast-warn', timeout || 4000);
  }

  confirm(message: string): boolean {
    return window.confirm(message);
  }

  confirmModal(message: string, title = 'Confirm'): Promise<boolean> {
    if (this.confirmService) {
      return this.confirmService.confirm(message, title);
    }
    // fallback DOM modal
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.style.position = 'fixed';
      backdrop.style.left = '0';
      backdrop.style.top = '0';
      backdrop.style.right = '0';
      backdrop.style.bottom = '0';
      backdrop.style.background = 'rgba(0,0,0,0.4)';
      backdrop.style.zIndex = '100000';

      const dialog = document.createElement('div');
      dialog.style.position = 'fixed';
      dialog.style.left = '50%';
      dialog.style.top = '50%';
      dialog.style.transform = 'translate(-50%,-50%)';
      dialog.style.background = '#fff';
      dialog.style.padding = '1rem';
      dialog.style.borderRadius = '8px';
      dialog.style.boxShadow = '0 6px 24px rgba(0,0,0,0.2)';
      dialog.style.minWidth = '320px';
      dialog.style.zIndex = '100001';

      const h = document.createElement('div');
      h.style.fontWeight = '600';
      h.style.marginBottom = '0.5rem';
      h.textContent = title;

      const msg = document.createElement('div');
      msg.style.marginBottom = '1rem';
      msg.textContent = message;

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.justifyContent = 'flex-end';
      actions.style.gap = '0.5rem';

      const btnCancel = document.createElement('button');
      btnCancel.textContent = 'Cancel';
      btnCancel.style.padding = '0.4rem 0.75rem';
      btnCancel.onclick = () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
        resolve(false);
      };

      const btnOk = document.createElement('button');
      btnOk.textContent = 'OK';
      btnOk.style.padding = '0.4rem 0.75rem';
      btnOk.style.background = '#0d6efd';
      btnOk.style.color = 'white';
      btnOk.style.border = 'none';
      btnOk.style.borderRadius = '4px';
      btnOk.onclick = () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
        resolve(true);
      };

      actions.appendChild(btnCancel);
      actions.appendChild(btnOk);
      dialog.appendChild(h);
      dialog.appendChild(msg);
      dialog.appendChild(actions);
      document.body.appendChild(backdrop);
      document.body.appendChild(dialog);
    });
  }
}
