import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']})
export class LoginComponent implements OnInit {
    loginForm!: FormGroup;
    loading = false;
    error: string | null = null;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loginForm = this.fb.group({
            username: ['', [Validators.required]],
            password: ['', [Validators.required]]
        });

        // Redirect if already logged in
        if (this.authService.isLoggedIn) {
            this.router.navigate(['/dashboard']);
        }
    }

    async onSubmit(): Promise<void> {
        if (this.loginForm.invalid) {
            this.error = 'Please enter username and password';
            return;
        }

        this.loading = true;
        this.error = null;

        try {
            const { username, password } = this.loginForm.value;
            const result = await this.authService.login(username, password);
            if (result?.success) {
                this.router.navigate(['/dashboard']);
            } else {
                this.error = result?.message ?? 'Invalid username or password';
            }
        } catch (err) {
            this.error = err instanceof Error ? err.message : 'Login failed. Please try again.';
        } finally {
            this.loading = false;
        }
    }

    get username() {
        return this.loginForm.get('username');
    }

    get password() {
        return this.loginForm.get('password');
    }
}
