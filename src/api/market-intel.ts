import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Đối thủ & thị trường (core-be MarketIntelController, /market-intel/*) — K11.

const ROOT = '/market-intel';

export interface Competitor {
  id: string;
  name: string;
  links: string[];
  area: string | null;
  note: string | null;
  isActive: boolean;
  noteCount: number;
  lastNoteAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitorInput {
  name: string;
  links: string[];
  area?: string | null;
  note?: string | null;
  isActive?: boolean;
}

export interface CompetitorNote {
  id: string;
  competitorId: string | null;
  competitorName: string | null;
  url: string | null;
  title: string | null;
  price: number | null;
  note: string | null;
  imageUrl: string | null;
  /** person | agent */
  source: string;
  createdByName: string | null;
  createdAt: string;
}

export interface CompetitorNoteInput {
  competitorId?: string | null;
  url?: string | null;
  title?: string | null;
  price?: number | null;
  note?: string | null;
}

export interface MarketTrend {
  topic: string | null;
  category: string | null;
  detail: string | null;
  evidence: string[] | null;
}

export interface MarketPrice {
  ciciProduct: string | null;
  ciciPrice: number | null;
  competitor: string | null;
  competitorPrice: number | null;
  url: string | null;
  note: string | null;
}

export interface MarketSuggestion {
  /** marketing | sales | purchasing | other */
  area: string | null;
  text: string | null;
  evidence: string[] | null;
  /** null | useful | not_useful */
  rating: string | null;
  ratedBy: string | null;
}

export interface MarketReport {
  id: string;
  weekStart: string;
  summary: string;
  trends: MarketTrend[];
  prices: MarketPrice[];
  suggestions: MarketSuggestion[];
  agentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export const marketCompetitorsKey = `${ROOT}/competitors`;
export const marketNotesKey = (days = 60) => `${ROOT}/notes?days=${days}`;
export const marketReportsKey = `${ROOT}/reports?take=12`;

function useList<T>(key: string) {
  const { data, isLoading, error, mutate } = useSWR<T[]>(key, fetcher);
  return useMemo(
    () => ({ items: data ?? [], loading: isLoading, error, mutate }),
    [data, isLoading, error, mutate]
  );
}

export const useCompetitors = () => useList<Competitor>(marketCompetitorsKey);
export const useMarketNotes = (days = 60) => useList<CompetitorNote>(marketNotesKey(days));
export const useMarketReports = () => useList<MarketReport>(marketReportsKey);

export async function saveCompetitor(id: string | null, input: CompetitorInput) {
  return id
    ? (await axios.put<Competitor>(`${ROOT}/competitors/${id}`, input)).data
    : (await axios.post<Competitor>(`${ROOT}/competitors`, input)).data;
}

export async function deleteCompetitor(id: string) {
  await axios.delete(`${ROOT}/competitors/${id}`);
}

export async function addMarketNote(input: CompetitorNoteInput) {
  return (await axios.post<CompetitorNote>(`${ROOT}/notes`, input)).data;
}

export async function deleteMarketNote(id: string) {
  await axios.delete(`${ROOT}/notes/${id}`);
}

export async function rateSuggestion(reportId: string, index: number, rating: string | null) {
  return (await axios.put<MarketReport>(`${ROOT}/reports/${reportId}/suggestions/${index}/rating`, { rating })).data;
}
