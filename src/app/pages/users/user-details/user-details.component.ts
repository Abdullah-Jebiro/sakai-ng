import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClientService, DataLogDto, UserDto } from '../../../services/api-client.service';
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
    templateUrl: './user-details.component.html'
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
