import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';
import { TokenGenerationUsingUsernameCommand } from '../../../core/services/api-client';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        PasswordModule,
        CardModule,
        ToastModule
    ],
    providers: [MessageService],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent {
    credentials = {
        username: '',
        password: ''
    };
    
    loading = false;
    errorMessage = '';

    constructor(
        private authService: AuthService,
        private router: Router,
        private messageService: MessageService
    ) {}

    onLogin(): void {
        if (!this.credentials.username || !this.credentials.password) {
            this.errorMessage = 'يرجى إدخال اسم المستخدم وكلمة المرور';
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        const command = new TokenGenerationUsingUsernameCommand({
            username: this.credentials.username,
            password: this.credentials.password
        });

        this.authService.login(command)
            .pipe(finalize(() => this.loading = false))
            .subscribe({
                next: (response) => {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'نجح تسجيل الدخول',
                        detail: 'مرحباً بك في نظام إدارة الأصول'
                    });
                    
                    // التوجه إلى الصفحة الرئيسية
                    setTimeout(() => {
                        this.router.navigate(['/assets']);
                    }, 1000);
                },
                error: (error) => {
                    console.error('Login error:', error);
                    
                    if (error.status === 401) {
                        this.errorMessage = 'اسم المستخدم أو كلمة المرور غير صحيحة';
                    } else if (error.status === 0) {
                        this.errorMessage = 'خطأ في الاتصال بالخادم';
                    } else {
                        this.errorMessage = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى';
                    }
                    
                    this.messageService.add({
                        severity: 'error',
                        summary: 'خطأ في تسجيل الدخول',
                        detail: this.errorMessage
                    });
                }
            });
    }
}