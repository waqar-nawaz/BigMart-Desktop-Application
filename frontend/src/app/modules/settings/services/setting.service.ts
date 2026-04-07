import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingModuleService {
    constructor() { }

    async loadAppSettings(): Promise<any> {
        return {};
    }

    async updateAppSetting(key: string, value: any): Promise<{ success: boolean }> {
        return { success: false };
    }
}
