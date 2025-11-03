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
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, InputTextModule, PaginatorModule, ToggleSwitchModule, ToastModule],
  providers: [MessageService],
  template: `
  <div class="flex items-center gap-2 mb-3">
    <input pInputText type="text" [(ngModel)]="query" placeholder="بحث" class="w-64"/>
    <button pButton label="بحث" (click)="load()"></button>
    <span class="flex-1"></span>
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
        <td class="flex gap-2">
          <button pButton icon="pi pi-refresh" label="جلب الآن" (click)="fetch(row)"></button>
          <button pButton icon="pi pi-trash" severity="danger" (click)="remove(row)"></button>
        </td>
      </tr>
    </ng-template>
  </p-table>
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

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.getUsers(this.query, this.page, this.pageSize).subscribe(res => {
      this.items.set(res.items);
      this.total = res.totalCount;
      this.page = res.pageNumber;
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
    // TODO: dialog for creating user
    this.toast.add({ severity: 'warn', summary: 'قريبًا', detail: 'نموذج الإضافة غير مُنفّذ بعد' });
  }
}
