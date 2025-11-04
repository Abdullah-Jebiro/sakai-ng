import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClientService, DataLogDto, UserDto } from '../../services/api-client.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
    selector: 'app-user-details',
    standalone: true,
    imports: [CommonModule, RouterModule, CardModule, ButtonModule, TagModule, ChartModule, TableModule, ToastModule, ProgressSpinnerModule],
    providers: [MessageService],
    template: `
        <p-toast></p-toast>

        <ng-container *ngIf="user(); else loadingBlock">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                <div>
                    <h2 class="text-2xl font-bold">{{ user()?.displayName || user()?.identifier }}</h2>
                    <p class="text-sm text-surface-500">{{ user()?.identifier }} • أنشئ في {{ user()?.created | date: 'medium' }}</p>
                    <p class="text-sm text-surface-500" *ngIf="latest()">آخر جلب: {{ latest()?.timestamp | date: 'medium' }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button pButton icon="pi pi-refresh" label="جلب الآن" (click)="fetchNow()" [loading]="fetching()"></button>
                    <button pButton icon="pi pi-download" label="تصدير CSV" (click)="export('csv')"></button>
                    <button pButton icon="pi pi-code" label="تصدير JSON" (click)="export('json')" severity="secondary"></button>
                    <button pButton icon="pi pi-arrow-right" label="عودة" [routerLink]="['/pages', 'users']" severity="secondary"></button>
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
                <p-card header="الرصيد الحالي">
                    <div class="text-4xl font-bold text-emerald-500" dir="ltr">{{ formatUsage(latest()?.usageGB) }}<span class="text-base ms-2">GB</span></div>
                    <p class="mt-2 text-sm text-surface-500">آخر قراءة في {{ latest()?.timestamp | date: 'short' }}</p>
                </p-card>

                <p-card header="الحالة">
                    <p-tag [value]="statusLabel()" [severity]="statusSeverity()"></p-tag>
                    <p class="mt-3 text-sm" *ngIf="latest()?.errorMessage">رسالة الخطأ: {{ latest()?.errorMessage }}</p>
                </p-card>

                <p-card header="معلومات إضافية">
                    <div class="space-y-2 text-sm">
                        <div>انتهاء الباقة: {{ latest()?.expiration ? (latest()?.expiration | date: 'mediumDate') : 'غير متوفر' }}</div>
                        <div>آخر فاتورة: {{ latest()?.lastInvoice ? (latest()?.lastInvoice | date: 'mediumDate') : 'غير متوفر' }}</div>
                        <div>
                            الاتصال الحالي: <strong>{{ latest()?.online === true ? 'متصل' : latest()?.online === false ? 'غير متصل' : 'غير معروف' }}</strong>
                        </div>
                    </div>
                </p-card>
            </div>

            <div class="grid gap-4 lg:grid-cols-2 mt-5">
                <p-card header="اتجاه الاستخدام">
                    <p-chart type="line" [data]="chartData()" [options]="chartOptions"></p-chart>
                </p-card>

                <p-card header="تفاصيل الحصة">
                    <div class="space-y-2 text-sm">
                        <div>حجم الحزمة: {{ formatUsage(latest()?.packageGB) }} GB</div>
                        <div>الخدمة الإضافية: {{ formatUsage(latest()?.serviceGB) }} GB</div>
                    </div>
                </p-card>
            </div>

            <p-card header="سجل الجلب" class="mt-5">
                <p-table [value]="logs()" [paginator]="true" [rows]="pageSize" [totalRecords]="totalLogs()" [lazy]="true" [loading]="loadingLogs()" (onLazyLoad)="onPage($event)" [first]="(page() - 1) * pageSize" [rowsPerPageOptions]="[10, 20, 50]">
                    <ng-template pTemplate="header">
                        <tr>
                            <th>التاريخ</th>
                            <th>الرصيد (GB)</th>
                            <th>النجاح</th>
                            <th>الحالة</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-row>
                        <tr>
                            <td>{{ row.timestamp | date: 'medium' }}</td>
                            <td dir="ltr">{{ row.usageGB ?? '—' }}</td>
                            <td>
                                <p-tag [value]="row.success ? 'ناجح' : 'فشل'" [severity]="row.success ? 'success' : 'danger'"></p-tag>
                            </td>
                            <td>{{ row.errorCategory || '—' }}</td>
                        </tr>
                    </ng-template>
                </p-table>
            </p-card>
        </ng-container>

        <ng-template #loadingBlock>
            <div class="flex items-center justify-center py-10">
                <p-progressSpinner></p-progressSpinner>
            </div>
        </ng-template>
    `
})
export class UserDetailsComponent implements OnInit {
    private api = inject(ApiClientService);
    private route = inject(ActivatedRoute);
    private toast = inject(MessageService);
    private destroyRef = inject(DestroyRef);

    private userId = 0;
    readonly pageSize = 20;

    user = signal<UserDto | null>(null);
    latest = signal<DataLogDto | null>(null);
    logs = signal<DataLogDto[]>([]);
    totalLogs = signal(0);
    page = signal(1);
    loadingLogs = signal(false);
    fetching = signal(false);

    chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: { display: true, text: 'GB' }
            }
        }
    };

    chartData = computed(() => {
        const points = [...this.logs()].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return {
            labels: points.map((p) => new Date(p.timestamp).toLocaleString()),
            datasets: [
                {
                    label: 'الاستهلاك (GB)',
                    data: points.map((p) => p.usageGB ?? null),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    tension: 0.3,
                    spanGaps: true,
                    fill: true
                }
            ]
        };
    });

    ngOnInit(): void {
        this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
            const idParam = params.get('id');
            const id = idParam ? Number(idParam) : NaN;
            if (!id || Number.isNaN(id)) {
                this.toast.add({ severity: 'error', summary: 'خطأ', detail: 'معرّف المستخدم غير صالح' });
                return;
            }
            this.userId = id;
            this.loadUser();
            this.loadLatest();
            this.loadLogs(1);
        });
    }

    private loadUser() {
        this.api
            .getUser(this.userId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (user) => this.user.set(user),
                error: () => this.toast.add({ severity: 'error', summary: 'تعذّر تحميل المستخدم' })
            });
    }

    private loadLatest() {
        this.api
            .getUserLatestStats(this.userId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (stat) => this.latest.set(stat),
                error: () => this.toast.add({ severity: 'warn', summary: 'لا توجد بيانات حديثة' })
            });
    }

    private loadLogs(page: number) {
        this.loadingLogs.set(true);
        this.api
            .getUserLogs(this.userId, { page, pageSize: this.pageSize })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (res) => {
                    this.logs.set(res.items);
                    this.totalLogs.set(res.totalCount);
                    this.page.set(res.pageNumber);
                    this.loadingLogs.set(false);
                },
                error: () => {
                    this.toast.add({ severity: 'error', summary: 'تعذّر تحميل السجل' });
                    this.loadingLogs.set(false);
                }
            });
    }

    onPage(event: any) {
        const newPage = Math.floor(event.first / event.rows) + 1;
        this.loadLogs(newPage);
    }

    fetchNow() {
        this.fetching.set(true);
        this.api
            .fetchNow(this.userId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.toast.add({ severity: 'success', summary: 'بدأ الجلب' });
                    setTimeout(() => {
                        this.fetching.set(false);
                        this.loadLatest();
                        this.loadLogs(this.page());
                    }, 1000);
                },
                error: () => {
                    this.toast.add({ severity: 'error', summary: 'تعذّر بدء الجلب' });
                    this.fetching.set(false);
                }
            });
    }

    export(format: 'json' | 'csv') {
        this.api
            .exportUserLogs(this.userId, format)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (blob) => {
                    const filename = `user-${this.userId}-logs.${format}`;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                },
                error: () => this.toast.add({ severity: 'error', summary: 'تعذّر التصدير' })
            });
    }

    formatUsage(value?: number | null) {
        if (value === null || value === undefined) {
            return '—';
        }
        return value.toFixed(2);
    }

    statusLabel() {
        const stat = this.latest();
        if (!stat) return 'لا بيانات';
        if (stat.success) return 'ناجح';
        return stat.errorCategory || 'فشل';
    }

    statusSeverity() {
        const stat = this.latest();
        if (!stat) return 'info';
        return stat.success ? 'success' : 'danger';
    }
}
