import axios, { endpoints } from 'src/utils/axios';
import { IKiotVietBankAccount, IVietQRBank } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getBankAccounts(): Promise<IKiotVietBankAccount[]> {
  const res = await axios.get(endpoints.bankAccounts.list);
  return res.data;
}

export async function getVietQRBanks(): Promise<IVietQRBank[]> {
  const res = await fetch('https://api.vietqr.io/v2/banks');
  const json = await res.json();
  if (json.code === '00') return json.data;
  return [];
}
