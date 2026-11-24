import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { IconComponent } from '../../shared/icon/icon.component';
import { AuthService } from '../../shared/services/auth.service';
import { authErrorMessage } from './auth-error';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.component.html',
  styleUrl: './auth-page.styles.scss',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    this.submitted.set(true);

    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');

    this.auth
      .signIn(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl(this.returnUrl()),
        error: (error: unknown) => {
          this.errorMessage.set(
            authErrorMessage(error, 'We could not sign you in. Check your details and try again.'),
          );
        },
      });
  }

  fieldError(field: 'email' | 'password'): string {
    const control = this.form.controls[field];

    if (!control.touched && !this.submitted()) {
      return '';
    }

    if (control.hasError('required')) {
      return field === 'email' ? 'Email is required.' : 'Password is required.';
    }
    if (control.hasError('email')) {
      return 'Enter a valid email address.';
    }
    if (control.hasError('maxlength')) {
      return 'Email is too long.';
    }

    return '';
  }

  private returnUrl(): string {
    const candidate = this.route.snapshot.queryParamMap.get('returnUrl');

    if (
      !candidate ||
      !candidate.startsWith('/') ||
      candidate.startsWith('//') ||
      /^\/(?:login|register)(?:[/?#]|$)/.test(candidate)
    ) {
      return '/';
    }

    return candidate;
  }
}
