import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientService, UserDto } from '../../../services/api-client.service';
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
  templateUrl: './users-list.component.html'
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
