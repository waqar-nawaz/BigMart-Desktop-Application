import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { AppSettings } from '../../../core/models';
import { ConfirmService } from '../../../shared/services/confirm.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']})
export class SettingsComponent implements OnInit {
  settingsForm!: FormGroup;
  saving = false;
  backingUp = false;

  constructor(
    private fb: FormBuilder,
    private electronService: ElectronService,
    private confirmService: ConfirmService
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.loadSettings();
  }

  createForm() {
    this.settingsForm = this.fb.group({
      store_name: ['', Validators.required],
      store_address: [''],
      store_phone: [''],
      store_email: ['', Validators.email],
      currency_symbol: ['Rs.'],
      tax_rate: [0],
      invoice_prefix: ['INV-'],
      receipt_footer: ['Thank you for shopping!'],
      low_stock_threshold: [5],
      backup_enabled: [true],
      theme: ['light'],
      printer_interface: ['system']
    });
  }

  async loadSettings() {
    try {
      const settings = await this.electronService.getSettings();
      // AppSettings is Record<string, string>, need to normalize for form
      // Some boolean values in DB might be strings "true"/"false" or "0"/"1"
      const normalizedS: any = {};
      Object.keys(settings).forEach(key => {
        let val: any = settings[key];
        if (val === 'true') val = true;
        if (val === 'false') val = false;
        if (!isNaN(Number(val)) && typeof val === 'string' && val.length < 5) val = Number(val);
        normalizedS[key] = val;
      });
      this.settingsForm.patchValue(normalizedS);
    } catch (err) { console.error(err); }
  }

  async saveSettings() {
    if (this.settingsForm.invalid) return;
    this.saving = true;
    try {
      const result = await this.electronService.updateSettings(this.settingsForm.value);
      if (result.success) {
        this.confirmService.alert({
          title: 'Settings Updated',
          message: 'Settings updated successfully.',
          type: 'success'
        });
        this.loadSettings();
      } else {
        this.confirmService.alert({
          title: 'Update Failed',
          message: result.message || 'Could not update settings',
          type: 'danger'
        });
      }
    } catch (err) { console.error(err); } finally { this.saving = false; }
  }

  async createBackup() {
    this.backingUp = true;
    try {
      const result = await this.electronService.createBackup();
      if (result.success) {
        this.confirmService.alert({
          title: 'Backup Created',
          message: 'Backup created successfully.',
          type: 'success'
        });
      } else {
        this.confirmService.alert({
          title: 'Backup Failed',
          message: result.message || 'Backup failed',
          type: 'danger'
        });
      }
    } catch (err) { console.error(err); } finally { this.backingUp = false; }
  }
}
