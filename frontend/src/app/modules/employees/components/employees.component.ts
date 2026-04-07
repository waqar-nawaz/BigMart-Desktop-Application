import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { User, UserRole } from '../../../core/models';

@Component({
  selector: 'app-employees',
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.scss']})
export class EmployeesComponent implements OnInit {
  users: User[] = [];
  loading = false;
  saving = false;
  showModal = false;
  isEditing = false;
  userForm!: FormGroup;

  constructor(
    private electronService: ElectronService, 
    private fb: FormBuilder,
    private confirmService: ConfirmService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  initForm() {
    this.userForm = this.fb.group({
      id: [''],
      username: ['', Validators.required],
      password: [''],
      full_name: ['', Validators.required],
      email: ['', Validators.email],
      pin: [''],
      role: ['cashier', Validators.required],
      is_active: [1]
    });
  }

  async loadUsers() {
    this.loading = true;
    try {
      this.users = await this.electronService.getAllUsers();
    } catch (err) { console.error(err); } finally { this.loading = false; }
  }

  openAddModal() {
    this.isEditing = false;
    this.userForm.reset({ role: 'cashier', is_active: 1 });
    this.userForm.get('password')?.setValidators(Validators.required);
    this.showModal = true;
  }

  openEditModal(user: User) {
    this.isEditing = true;
    this.userForm.patchValue({ ...user, password: '' });
    this.userForm.get('password')?.setValidators(null);
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  async saveUser() {
    if (this.userForm.invalid) return;
    this.saving = true;
    try {
      const result = this.isEditing
        ? await this.electronService.updateUser(this.userForm.value)
        : await this.electronService.createUser(this.userForm.value);

      if (result.success) {
        this.loadUsers();
        this.closeModal();
      } else {
        this.confirmService.alert({
          title: 'Save Error',
          message: result.message || 'Could not save user',
          type: 'danger'
        });
      }
    } catch (err) { console.error(err); } finally { this.saving = false; }
  }
}
