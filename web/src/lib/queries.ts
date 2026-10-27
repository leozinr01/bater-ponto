import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './api';
import type {
  Absence,
  AbsenceType,
  Employee,
  Holiday,
  HourBank,
  HourBankEntry,
  Paginated,
  Punch,
  RegisteredPunch,
  ReportItem,
  Role,
  Timesheet,
  TodayOverview,
  WorkSchedule,
  WorkScheduleInput,
} from './types';

// ---- Ponto ----

export function useTimesheet(params: {
  employeeId?: string;
  from: string;
  to: string;
}) {
  return useQuery({
    queryKey: ['timesheet', params],
    queryFn: () => api<Timesheet>('/punches/timesheet', { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function usePunches(params: {
  employeeId?: string;
  from?: string;
  to?: string;
  includeVoided?: boolean;
  page: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['punches', params],
    queryFn: () => api<Paginated<Punch>>('/punches', { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function useReport(params: { from: string; to: string; page: number }) {
  return useQuery({
    queryKey: ['report', params],
    queryFn: () =>
      api<Paginated<ReportItem>>('/punches/report', {
        query: { ...params, pageSize: 50 },
      }),
    placeholderData: keepPreviousData,
  });
}

/** Painel do dia (admin), atualizado a cada minuto. */
export function useToday() {
  return useQuery({
    queryKey: ['today'],
    queryFn: () => api<TodayOverview>('/punches/today'),
    refetchInterval: 60_000,
  });
}

/** Invalida tudo que depende das marcações. */
function useInvalidatePunches() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['timesheet', 'punches', 'report', 'today', 'hour-bank'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useRegisterPunch() {
  const invalidate = useInvalidatePunches();
  return useMutation({
    mutationFn: () => api<RegisteredPunch>('/punches', { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useManualPunch() {
  const invalidate = useInvalidatePunches();
  return useMutation({
    mutationFn: (body: {
      employeeId: string;
      timestamp: string;
      reason: string;
    }) => api('/punches/manual', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useVoidPunch() {
  const invalidate = useInvalidatePunches();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/punches/${id}/void`, { method: 'POST', body: { reason } }),
    onSuccess: invalidate,
  });
}

export function useReplacePunch() {
  const invalidate = useInvalidatePunches();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      timestamp: string;
      reason: string;
    }) => api(`/punches/${id}/replace`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

// ---- Funcionários ----

export interface EmployeeFilters {
  search?: string;
  active?: boolean;
  role?: Role;
  page?: number;
  pageSize?: number;
}

export function useEmployees(filters: EmployeeFilters, enabled = true) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: () => api<Paginated<Employee>>('/employees', { query: { ...filters } }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export interface EmployeeInput {
  name: string;
  email: string;
  role: Role;
  workScheduleId: string | null;
  password?: string;
  active?: boolean;
}

export function useSaveEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: EmployeeInput & { id?: string }) => {
      if (id) return api<Employee>(`/employees/${id}`, { method: 'PATCH', body });
      // No cadastro, sem jornada = campo omitido
      const { workScheduleId, ...rest } = body;
      return api<Employee>('/employees', {
        method: 'POST',
        body: workScheduleId ? { ...rest, workScheduleId } : rest,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
    },
  });
}

export function useSetEmployeeActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api<Employee>(`/employees/${id}`, { method: 'PATCH', body: { active } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api<void>(`/employees/${id}/password`, {
        method: 'POST',
        body: { password },
      }),
  });
}

// ---- Jornadas ----

export function useSchedules(enabled = true) {
  return useQuery({
    queryKey: ['work-schedules'],
    queryFn: () =>
      api<Paginated<WorkSchedule>>('/work-schedules', {
        query: { pageSize: 100 },
      }),
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: WorkScheduleInput & { id?: string }) =>
      id
        ? api<WorkSchedule>(`/work-schedules/${id}`, { method: 'PATCH', body })
        : api<WorkSchedule>('/work-schedules', { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
    },
  });
}

// ---- Feriados ----

export function useHolidays(year: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api<Holiday[]>('/holidays', { query: { year } }),
  });
}

/** Feriados mudam faltas e saldos: invalida os cálculos junto. */
function useInvalidateHolidays() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['holidays', 'timesheet', 'report', 'today', 'hour-bank'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useCreateHoliday() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (body: { date: string; name: string }) => api<Holiday>('/holidays', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteHoliday() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useImportNationalHolidays() {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (year: number) =>
      api<{ created: number; skipped: number }>('/holidays/national', { method: 'POST', query: { year } }),
    onSuccess: invalidate,
  });
}

// ---- Abonos ----

export function useAbsences(params: { employeeId?: string; from: string; to: string }) {
  return useQuery({
    queryKey: ['absences', params],
    queryFn: () => api<Absence[]>('/absences', { query: params }),
  });
}

/** Abonos mudam faltas e saldos: invalida os cálculos junto. */
function useInvalidateAbsences() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['absences', 'timesheet', 'report', 'today', 'hour-bank'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useCreateAbsence() {
  const invalidate = useInvalidateAbsences();
  return useMutation({
    mutationFn: (body: { employeeId: string; type: AbsenceType; startDate: string; endDate: string; reason: string }) =>
      api<Absence>('/absences', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useCancelAbsence() {
  const invalidate = useInvalidateAbsences();
  return useMutation({
    mutationFn: (id: string) => api<Absence>(`/absences/${id}/cancel`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

// ---- Banco de horas ----

export function useHourBank(params: { employeeId?: string }) {
  return useQuery({
    queryKey: ['hour-bank', params],
    queryFn: () => api<HourBank>('/hour-bank', { query: params }),
  });
}

function useInvalidateHourBank() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(['hour-bank', 'report'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useCreateHourBankEntry() {
  const invalidate = useInvalidateHourBank();
  return useMutation({
    mutationFn: (body: { employeeId: string; date: string; minutes: number; reason: string }) =>
      api<HourBankEntry>('/hour-bank/entries', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useCancelHourBankEntry() {
  const invalidate = useInvalidateHourBank();
  return useMutation({
    mutationFn: (id: string) => api<HourBankEntry>(`/hour-bank/entries/${id}/cancel`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}
