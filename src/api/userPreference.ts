import axios, { endpoints } from 'src/utils/axios';

import type { ISetShiftPreferencesDto, IStaffShiftPreferenceSummary, IUserShiftPreferenceResponse } from 'src/types/corecms-api';

export async function getMyShiftPreferences(): Promise<IUserShiftPreferenceResponse[]> {
  const response = await axios.get<IUserShiftPreferenceResponse[]>(
    endpoints.userPreference.myShiftPreferences
  );
  return response.data;
}

export async function setMyShiftPreferences(data: ISetShiftPreferencesDto): Promise<void> {
  await axios.post(endpoints.userPreference.myShiftPreferences, data);
}

export async function getStaffShiftPreferences(
  userId: string
): Promise<IUserShiftPreferenceResponse[]> {
  const response = await axios.get<IUserShiftPreferenceResponse[]>(
    endpoints.userPreference.staffShiftPreferences(userId)
  );
  return response.data;
}

export async function getAllStaffShiftPreferences(): Promise<IStaffShiftPreferenceSummary[]> {
  const response = await axios.get<IStaffShiftPreferenceSummary[]>(
    endpoints.userPreference.allStaffShiftPreferences
  );
  return response.data;
}
