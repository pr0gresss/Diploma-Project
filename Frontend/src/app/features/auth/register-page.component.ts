import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { IconComponent } from '../../shared/icon/icon.component';
import { AuthService } from '../../shared/services/auth.service';
import { authErrorMessage } from './auth-error';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register-page.component.html',
  styleUrl: './auth-page.styles.scss',
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.formBuilder.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
      password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  submit(): void {
    this.submitted.set(true);

    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');

    const { email, password } = this.form.getRawValue();

    this.auth
      .register({ email, password })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl('/'),
        error: (error: unknown) => {
          this.errorMessage.set(
            authErrorMessage(error, 'We could not create your account. Please try again.'),
          );
        },
      });
  }

  fieldError(field: 'email' | 'password' | 'confirmPassword'): string {
    const control = this.form.controls[field];

    if (!control.touched && !this.submitted()) {
      return '';
    }

    if (control.hasError('required')) {
      return `${this.fieldLabel(field)} is required.`;
    }
    if (control.hasError('email')) {
      return 'Enter a valid email address.';
    }
    if (control.hasError('maxlength')) {
      return field === 'email' ? 'Email is too long.' : 'Password is too long.';
    }
    if (control.hasError('minlength')) {
      return 'Use at least 12 characters.';
    }
    if (field === 'confirmPassword' && this.form.hasError('passwordMismatch')) {
      return 'Passwords do not match.';
    }

    return '';
  }

  private fieldLabel(field: 'email' | 'password' | 'confirmPassword'): string {
    return field === 'email' ? 'Email' : field === 'password' ? 'Password' : 'Confirmation';
  }
}
