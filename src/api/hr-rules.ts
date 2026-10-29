import { useState, useEffect } from 'react';

import axios, { endpoints } from 'src/utils/axios';

import type { IHrRules, IHrRuleSettings } from 'src/types/hr-rules';

// ----------------------------------------------------------------------
// Luật nhân sự riêng của cửa hàng — Core-be /hr-rule-settings. Xem / sửa cần hr.rule.manage (Admin); /active mọi nhân viên
// đọc được để ẩn phần cửa hàng đã tắt.
// ----------------------------------------------------------------------

export async function getHrRuleSettings(): Promise<IHrRuleSettings> {
  const response = await axios.get<IHrRuleSettings>(endpoints.hr.ruleSettings);
  return response.data;
}

export async function saveHrRuleSettings(body: IHrRules): Promise<IHrRuleSettings> {
  const response = await axios.put<IHrRuleSettings>(endpoints.hr.ruleSettings, body);
  return response.data;
}

export async function getActiveHrRules(): Promise<IHrRules> {
  const response = await axios.get<IHrRules>(endpoints.hr.ruleSettingsActive);
  return response.data;
}

let cached: Promise<IHrRules | null> | null = null;

/** Luật đang bật của cửa hàng (nhớ trong phiên trang). null khi chưa tải xong hoặc không tải được. */
export function useActiveHrRules(): IHrRules | null {
  const [rules, setRules] = useState<IHrRules | null>(null);

  useEffect(() => {
    let alive = true;
    cached ??= getActiveHrRules().catch(() => {
      cached = null;
      return null;
    });
    cached.then((r) => {
      if (alive) setRules(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  return rules;
}

/** Sau khi Admin lưu cấu hình: các trang đọc lại. */
export function resetActiveHrRules() {
  cached = null;
}

/** "22:00:00" → "22:00". */
export function shortTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '';
}
