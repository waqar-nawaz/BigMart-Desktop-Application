import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { Shift } from '../../../core/models';

@Component({
  selector: 'app-shifts',
  templateUrl: './shifts.component.html',
  styleUrls: ['./shifts.component.scss']
})
export class ShiftsComponent implements OnInit {
  activeShift: Shift | null = null;
  shiftHistory: Shift[] = [];
  
  showOpenModal = false;
  showCloseModal = false;
  
  openForm!: FormGroup;
  closeForm!: FormGroup;
  
  loading = false;
  processing = false;

  constructor(
    private electronService: ElectronService,
    public authService: AuthService,
    private fb: FormBuilder,
    private confirmService: ConfirmService
  ) {
    this.openForm = this.fb.group({
      opening_cash: [0, [Validators.required, Validators.min(0)]]
    });
    this.closeForm = this.fb.group({
      closing_cash: [0, [Validators.required, Validators.min(0)]],
      notes: ['']
    });
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const user = this.authService.currentUser;
      if (user) {
        this.activeShift = await this.electronService.getActiveShift(user.id);
        this.authService.setActiveShift(this.activeShift);
      }
      this.shiftHistory = await this.electronService.getAllShifts();
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  openShiftModal() {
    this.openForm.reset({ opening_cash: 0 });
    this.showOpenModal = true;
  }

  closeShiftModal() {
    this.closeForm.reset({ closing_cash: 0, notes: '' });
    this.showCloseModal = true;
  }

  async submitOpenShift() {
    if (this.openForm.invalid || !this.authService.currentUser) return;
    this.processing = true;
    try {
      const amount = this.openForm.value.opening_cash;
      const res = await this.electronService.openShift({ cashier_id: this.authService.currentUser.id, opening_cash: amount });
      if (res?.success) {
        this.showOpenModal = false;
        this.loadData();
      } else {
        this.confirmService.alert({
          title: 'Shift Error',
          message: res?.message || 'Error opening shift',
          type: 'danger'
        });
      }
    } catch(e) { console.error(e); } finally {
      this.processing = false;
    }
  }

  async submitCloseShift() {
    if (this.closeForm.invalid || !this.activeShift) return;
    this.processing = true;
    try {
      const { closing_cash, notes } = this.closeForm.value;
      const res = await this.electronService.closeShift({ shift_id: this.activeShift.id, closing_cash, notes });
      if (res?.success) {
        this.showCloseModal = false;
        this.loadData();
      } else {
        this.confirmService.alert({
          title: 'Shift Error',
          message: res?.message || 'Error closing shift',
          type: 'danger'
        });
      }
    } catch(e) { console.error(e); } finally {
      this.processing = false;
    }
  }
}
