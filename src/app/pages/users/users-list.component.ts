import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientService, UserDto } from '../../services/api-client.service';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, InputTextModule, PaginatorModule, ToggleSwitchModule, ToastModule, DialogModule, RouterModule],
  providers: [MessageService],
  template: `
  <div class="flex items-center gap-2 mb-3">
    <input pInputText type="text" [(ngModel)]="query" placeholder="بحث" class="w-64"/>
    <button pButton label="بحث" (click)="load()"></button>
    <span class="flex-1"></span>
    <button pButton label="جلب للجميع" icon="pi pi-refresh" severity="secondary" (click)="fetchAll()"></button>
    <button pButton label="إضافة" icon="pi pi-plus" (click)="openCreate()"></button>
  </div>

  <p-table [value]="items()" [rows]="pageSize" [paginator]="true" [totalRecords]="total" [lazy]="true"
           (onLazyLoad)="onPage($event)" [rowsPerPageOptions]="[10,20,50]" [first]="(page-1)*pageSize">
    <ng-template pTemplate="header">
      <tr>
        <th>المعرف</th>
        <th>الاسم</th>
        <th>مفعل</th>
        <th>آخر جلب</th>
        <th>الحالة</th>
        <th style="width:220px"></th>
      </tr>
    </ng-template>
    <ng-template pTemplate="body" let-row>
      <tr>
        <td>{{row.identifier}}</td>
        <td>{{row.displayName}}</td>
        <td>
          <p-toggleSwitch [(ngModel)]="row.isActive" (onChange)="saveActive(row)"></p-toggleSwitch>
        </td>
        <td>{{row.lastFetchAt | date:'short'}}</td>
        <td>{{row.lastFetchStatus}}</td>
        <td class="flex flex-wrap gap-2">
          <button pButton icon="pi pi-info-circle" label="تفاصيل" [routerLink]="['/pages', 'users', row.id]"></button>
          <button pButton icon="pi pi-refresh" label="جلب الآن" (click)="fetch(row)"></button>
          <button pButton icon="pi pi-trash" severity="danger" (click)="remove(row)"></button>
        </td>
      </tr>
    </ng-template>
  </p-table>

  <!-- Dialog: Create User -->
  <p-dialog [(visible)]="createVisible" [modal]="true" [style]="{width:'30rem'}" [draggable]="false" header="إضافة حساب للمراقبة">
    <div class="flex flex-col gap-3">
      <div>
        <label class="block mb-1">المعرف (هاتف/إيميل)</label>
        <input pInputText class="w-full" [(ngModel)]="createModel.identifier" placeholder="مثال: 0966xxxxxxx"/>
      </div>
      <div>
        <label class="block mb-1">الاسم الظاهر</label>
        <input pInputText class="w-full" [(ngModel)]="createModel.displayName" placeholder="اختياري"/>
      </div>
      <div>
        <label class="block mb-1">كلمة المرور</label>
        <input pInputText type="password" class="w-full" [(ngModel)]="createModel.password"/>
      </div>
      <div class="flex items-center gap-2">
        <p-toggleSwitch [(ngModel)]="createModel.isActive"></p-toggleSwitch>
        <span>تفعيل الجدولة</span>
      </div>

      <div class="flex justify-end gap-2 mt-3">
        <button pButton label="إلغاء" severity="secondary" (click)="createVisible=false"></button>
        <button pButton label="حفظ" icon="pi pi-check" (click)="saveCreate()" [disabled]="!canSaveCreate()" [loading]="saving"></button>
      </div>
    </div>
  </p-dialog>
  `
})
export class UsersListComponent implements OnInit {
  private api = inject(ApiClientService);
  private toast = inject(MessageService);

  items = signal<UserDto[]>([]);
  total = 0;
  page = 1;
  pageSize = 10;
  query = '';
  createVisible = false;
  saving = false;
  createModel = { identifier: '', displayName: '', password: '', isActive: true };

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.getUsers(this.query, this.page, this.pageSize).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total = res.totalCount;
        this.page = res.pageNumber;
      },
      error: (err) => {
        const detail = err?.error?.title || err?.message || 'تعذّر تحميل القائمة';
        this.toast.add({ severity: 'error', summary: 'خطأ الشبكة', detail });
      }
    });
  }

  onPage(event: any) {
    this.page = Math.floor(event.first / event.rows) + 1;
    this.pageSize = event.rows;
    this.load();
  }

  saveActive(row: UserDto) {
    this.api.updateUser(row.id, { identifier: row.identifier, displayName: row.displayName, isActive: row.isActive }).subscribe(() => {
      this.toast.add({ severity: 'success', summary: 'تم الحفظ' });
    });
  }

  fetch(row: UserDto) {
    this.api.fetchNow(row.id).subscribe(() => {
      this.toast.add({ severity: 'info', summary: 'بدأ الجلب' });
      setTimeout(() => this.load(), 1000);
    });
  }

  remove(row: UserDto) {
    this.api.deleteUser(row.id).subscribe(() => {
      this.toast.add({ severity: 'success', summary: 'تم الحذف' });
      this.load();
    });
  }

  openCreate() {
    this.createModel = { identifier: '', displayName: '', password: '', isActive: true };
    this.createVisible = true;
  }

  canSaveCreate() {
    return this.createModel.identifier.trim().length > 0 && this.createModel.password.trim().length > 0;
  }

  saveCreate() {
    this.saving = true;
    this.api.createUser(this.createModel).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'تمت الإضافة' });
        this.saving = false;
        this.createVisible = false;
        this.load();
      },
      error: (err) => {
        const msg = err?.error?.title || err?.error || 'تعذّر الإضافة';
        this.toast.add({ severity: 'error', summary: 'خطأ', detail: msg });
        this.saving = false;
      }
    });
  }

  fetchAll() {
    this.api.fetchAllActive().subscribe(() => {
      this.toast.add({ severity: 'info', summary: 'بدأ الجلب للجميع' });
      setTimeout(() => this.load(), 1500);
    });
  }
}
