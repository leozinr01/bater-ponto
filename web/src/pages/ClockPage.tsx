import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Balance, DayStatusBadge } from '../components/timesheet';
import { useToast } from '../components/toast';
import { Alert, Button, Card, Loading, Stat } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { currentMonth, formatDuration, formatMinutes, monthRange, timeOf, today } from '../lib/format';
import { useRegisterPunch, useTimesheet } from '../lib/queries';
import type { RegisteredPunch } from '../lib/types';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function ClockPage() {
  const { user } = useAuth();
  const now = useNow();
  const toast = useToast();
  const { from, to } = monthRange(currentMonth());
  const sheet = useTimesheet({ from, to });
  const register = useRegisterPunch();
  const [last, setLast] = useState<RegisteredPunch | null>(null);

  const tz = sheet.data?.timezone;
  const todayDate = today(tz);
  const day = sheet.data?.days.find((d) => d.date === todayDate);
  const openPeriod = day?.periods.find((p) => p.end === null);
  // Uma jornada noturna aberta ontem também faz a próxima marcação ser saída
  const working = sheet.data?.days.some((d) => d.status === 'in_progress');
  const nextAction = working ? 'saída' : 'entrada';

  // Minutos trabalhados até agora, contando o período em aberto
  const workedNow =
    (day?.workedMinutes ?? 0) +
    (openPeriod ? Math.max(0, Math.floor((now.getTime() - new Date(openPeriod.start).getTime()) / 60_000)) : 0);

  const onPunch = () =>
    register.mutate(undefined, {
      onSuccess: (punch) => {
        setLast(punch);
        toast(`${punch.interpretedAs === 'entrada' ? 'Entrada' : 'Saída'} registrada às ${timeOf(punch.localTime)}`);
      },
    });

  const clockTime = now.toLocaleTimeString('pt-BR', { timeZone: tz });
  const clockDate = now.toLocaleDateString('pt-BR', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="flex flex-col items-center px-6 py-10 text-center lg:col-span-3">
        <p className="text-sm text-slate-500">Olá, {user?.name.split(' ')[0]}</p>
        <p className="mt-4 text-6xl font-semibold tracking-tight tabular-nums text-slate-900 sm:text-7xl">
          {clockTime}
        </p>
        <p className="mt-2 text-sm text-slate-500 first-letter:uppercase">{clockDate}</p>

        <Button
          onClick={onPunch}
          loading={register.isPending}
          className="mt-8 h-14 w-full max-w-xs rounded-xl text-base shadow-sm"
        >
          Registrar ponto
        </Button>
        {sheet.data && (
          <p className="mt-3 text-sm text-slate-500">
            Próxima marcação: <span className="font-medium text-slate-700">{nextAction}</span>
          </p>
        )}

        <div className="mt-4 w-full max-w-sm space-y-2">
          {register.isError && <Alert>{errorMessage(register.error)}</Alert>}
          {last && !register.isError && (
            <Alert tone="success">
              {last.interpretedAs === 'entrada' ? 'Entrada' : 'Saída'} registrada às{' '}
              <strong>{timeOf(last.localTime)}</strong>.
            </Alert>
          )}
        </div>
        <p className="mt-6 max-w-sm text-xs text-slate-400">
          O horário registrado é sempre o do servidor. Entrada e saída são definidas pela ordem das
          marcações.
        </p>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Hoje</h2>
            {day && <DayStatusBadge day={day} />}
          </div>
          {sheet.isPending ? (
            <Loading />
          ) : sheet.isError ? (
            <div className="p-5">
              <Alert>{errorMessage(sheet.error)}</Alert>
            </div>
          ) : (
            <div className="p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-500">Trabalhado</span>
                <span className="text-2xl font-semibold tabular-nums">{formatMinutes(workedNow)}</span>
              </div>
              {day?.expectedMinutes ? (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(100, (workedNow / day.expectedMinutes) * 100)}%` }}
                  />
                </div>
              ) : null}
              {day?.expectedMinutes ? (
                <p className="mt-1 text-xs text-slate-500">de {formatDuration(day.expectedMinutes)} previstas</p>
              ) : null}

              <ul className="mt-5 space-y-2">
                {day?.periods.length ? (
                  day.periods.map((p, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="tabular-nums">
                        <span className="text-slate-500">Entrada</span> {timeOf(p.start)}
                        <span className="mx-2 text-slate-300">→</span>
                        <span className="text-slate-500">Saída</span>{' '}
                        {p.end ? timeOf(p.end) : <span className="text-sky-600">em aberto</span>}
                      </span>
                      {p.end && <span className="text-xs text-slate-500 tabular-nums">{formatMinutes(p.minutes)}</span>}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-slate-500">Nenhuma marcação hoje.</li>
                )}
              </ul>
            </div>
          )}
        </Card>

        {sheet.data && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Este mês</h2>
              <Link to="/espelho" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Ver espelho →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Trabalhado" value={formatMinutes(sheet.data.totals.workedMinutes)} />
              <Stat
                label="Saldo"
                value={
                  <Balance
                    overtime={sheet.data.totals.overtimeMinutes}
                    deficit={sheet.data.totals.deficitMinutes}
                  />
                }
              />
              <Stat
                label="Faltas"
                value={sheet.data.totals.absentDays}
                tone={sheet.data.totals.absentDays ? 'red' : undefined}
              />
              <Stat
                label="Incompletos"
                value={sheet.data.totals.incompleteDays}
                tone={sheet.data.totals.incompleteDays ? 'amber' : undefined}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
