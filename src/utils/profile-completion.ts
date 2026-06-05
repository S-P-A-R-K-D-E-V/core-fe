import { IUser } from 'src/types/corecms-api';

export interface ProfileCompletionStep {
  key: string;
  label: string;
  done: boolean;
  weight: number;
}

export function getProfileCompletion(user: IUser | null): {
  percent: number;
  steps: ProfileCompletionStep[];
  cccdMissing: boolean;
} {
  if (!user) return { percent: 0, steps: [], cccdMissing: true };

  const steps: ProfileCompletionStep[] = [
    { key: 'firstName',       label: 'Họ và tên',          done: !!(user.firstName && user.lastName), weight: 1 },
    { key: 'email',           label: 'Email',               done: !!user.email,                        weight: 1 },
    { key: 'phoneNumber',     label: 'Số điện thoại',       done: !!user.phoneNumber,                  weight: 1 },
    { key: 'address',         label: 'Địa chỉ',             done: !!user.address,                      weight: 1 },
    { key: 'bankCode',        label: 'Ngân hàng',           done: !!user.bankCode,                     weight: 1 },
    { key: 'bankNo',          label: 'Số tài khoản',        done: !!user.bankNo,                       weight: 1 },
    { key: 'profileImageUrl', label: 'Ảnh đại diện',        done: !!user.profileImageUrl,              weight: 1 },
    { key: 'idCardFrontUrl',  label: 'CCCD mặt trước',      done: !!user.idCardFrontUrl,               weight: 1.5 },
    { key: 'idCardBackUrl',   label: 'CCCD mặt sau',        done: !!user.idCardBackUrl,                weight: 0.5 },
  ];

  const totalWeight  = steps.reduce((s, st) => s + st.weight, 0);
  const doneWeight   = steps.reduce((s, st) => s + (st.done ? st.weight : 0), 0);
  const percent      = Math.round((doneWeight / totalWeight) * 100);
  const cccdMissing  = !user.idCardFrontUrl || !user.idCardBackUrl;

  return { percent, steps, cccdMissing };
}
