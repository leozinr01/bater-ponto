import { CalendarDays, KeyRound, Pencil, Power, Search, UserPlus, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/toast';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Segmented,
  Select,
  table,
} from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, formatDuration } from '../../lib/format';
import {
  useEmployees,
  useResetPassword,
  useSaveEmployee,
  useSchedules,
  useSetEmployeeActive,
  type EmployeeFilters,
} from '../../lib/queries';
import type { Employee, Role } from '../../lib/types';

function EmployeeFormModal({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const save = useSaveEmployee();
  const schedules = useSchedules();
  const isNew = !employee;
  const isSelf = employee?.id === user?.id;

  const [name, setName] = useState(employee?.name ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(employee?.role ?? 'EMPLOYEE');
  const [workScheduleId, setWorkScheduleId] = useState(employee?.workScheduleId ?? '');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: employee?.id,
        name: name.trim(),
        email: email.trim(),
        role,
        workScheduleId: workScheduleId || null,
        ...(isNew && { password }),
      },
      {
        onSuccess: (saved) => {
          toast(isNew ? `${saved.name} cadastrado(a).` : 'Alterações salvas.');
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={isNew ? UserPlus : Pencil}
      title={isNew ? 'Novo funcionário' : `Editar ${employee.name}`}
      description={isNew ? 'O funcionário entra com o e-mail e a senha inicial.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="employee-form" loading={save.isPending}>
            {isNew ? 'Cadastrar' : 'Salvar'}
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={onSubmit} className="space-y-4">
        {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
        <Field label="Nome completo">
          {(id) => <Input id={id} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="E-mail">
          {(id) => <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        {isNew && (
          <Field label="Senha inicial" hint="Mínimo de 8 caracteres. O funcionário pode trocá-la em Minha conta.">
            {(id) => (
              <Input
                id={id}
                type="text"
                autoComplete="off"
                required
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
        )}
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-300">Perfil</span>
          {isSelf ? (
            <p className="text-sm text-slate-500">Você não pode alterar o próprio perfil.</p>
          ) : (
            <Segmented
              className="flex w-full"
              value={role}
              onChange={setRole}
              options={[
                { value: 'EMPLOYEE', label: 'Funcionário' },
                { value: 'ADMIN', label: 'Administrador' },
              ]}
            />
          )}
        </div>
        <Field
          label="Jornada"
          hint={
            !workScheduleId
              ? 'Sem jornada, os registros mostram as horas trabalhadas, mas não atrasos, extras e faltas.'
              : undefined
          }
        >
          {(id) => (
            <Select id={id} value={workScheduleId} onChange={(e) => setWorkScheduleId(e.target.value)}>
              <option value="">Sem jornada</option>
              {schedules.data?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatDuration(s.dailyMinutes)}, entrada {s.startTime})
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const toast = useToast();
  const reset = useResetPassword();
  const [password, setPassword] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    reset.mutate(
      { id: employee.id, password },
      {
        onSuccess: () => {
          toast(`Senha de ${employee.name} redefinida.`);
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={KeyRound}
      title="Redefinir senha"
      description={`${employee.name} será desconectado(a) de todas as sessões.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="reset-form" loading={reset.isPending}>
            Redefinir
          </Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={onSubmit} className="space-y-4">
        {reset.isError && <Alert>{errorMessage(reset.error)}</Alert>}
        <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
          {(id) => (
            <Input
              id={id}
              type="text"
              autoComplete="off"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

/** Botão só de ícone, com dica ao passar o mouse. */
function IconAction({
  label,
  icon: IconCmp,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg p-2 text-slate-500 transition-colors disabled:opacity-40',
        danger ? 'hover:bg-red-500/10 hover:text-red-300' : 'hover:bg-white/5 hover:text-white',
      )}
    >
      <IconCmp className="size-4" />
    </button>
  );
}

type StatusFilter = 'active' | 'inactive' | 'all';
type RoleFilter = 'all' | Role;

export function EmployeesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [role, setRole] = useState<RoleFilter>('all');
  const [filters, setFilters] = useState<EmployeeFilters>({ active: true, page: 1, pageSize: 20 });
  const employees = useEmployees(filters);
  const schedules = useSchedules();
  const setActive = useSetEmployeeActive();
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [resetting, setResetting] = useState<Employee | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => ({ ...f, search: search.trim() || undefined, page: 1 })), 300);
    return () => clearTimeout(id);
  }, [search]);

  const onStatus = (value: StatusFilter) => {
    setStatus(value);
    setFilters((f) => ({ ...f, page: 1, active: value === 'all' ? undefined : value === 'active' }));
  };
  const onRole = (value: RoleFilter) => {
    setRole(value);
    setFilters((f) => ({ ...f, page: 1, role: value === 'all' ? undefined : value }));
  };

  const schedule = (id: string | null) => (id ? schedules.data?.data.find((s) => s.id === id) : undefined);

  const toggleActive = (e: Employee) =>
    setActive.mutate(
      { id: e.id, active: !e.active },
      {
        onSuccess: () => toast(`${e.name} ${e.active ? 'desativado(a)' : 'reativado(a)'}.`),
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    );

  return (
    <>
      <PageHeader
        icon={Users}
        title="Funcionários"
        description="Ninguém é excluído: desative o acesso e os registros são mantidos."
        actions={
          <Button icon={UserPlus} onClick={() => setEditing('new')}>
            Novo funcionário
          </Button>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            type="search"
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Segmented
          value={status}
          onChange={onStatus}
          options={[
            { value: 'active', label: 'Ativos' },
            { value: 'inactive', label: 'Inativos' },
            { value: 'all', label: 'Todos' },
          ]}
        />
        <Segmented
          value={role}
          onChange={onRole}
          options={[
            { value: 'all', label: 'Todos os perfis' },
            { value: 'EMPLOYEE', label: 'Funcionários' },
            { value: 'ADMIN', label: 'Admins' },
          ]}
        />
      </Card>

      {employees.isPending ? (
        <Loading />
      ) : employees.isError ? (
        <Alert>{errorMessage(employees.error)}</Alert>
      ) : (
        <Card className={cn('overflow-hidden transition-opacity', employees.isFetching && 'opacity-60')}>
          {employees.data.data.length === 0 ? (
            <EmptyState
              icon={Users}
              action={
                <Button size="sm" icon={UserPlus} onClick={() => setEditing('new')}>
                  Cadastrar funcionário
                </Button>
              }
            >
              Nenhum funcionário encontrado com esses filtros.
            </EmptyState>
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.thead}>
                  <tr>
                    <th className={table.th}>Funcionário</th>
                    <th className={table.th}>Perfil</th>
                    <th className={table.th}>Jornada</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th}>Desde</th>
                    <th className={table.th} />
                  </tr>
                </thead>
                <tbody className={table.tbody}>
                  {employees.data.data.map((e) => {
                    const isSelf = e.id === user?.id;
                    const s = schedule(e.workScheduleId);
                    return (
                      <tr key={e.id} className={cn(table.tr, !e.active && 'opacity-50')}>
                        <td className={table.td}>
                          <div className="flex items-center gap-3">
                            <Avatar name={e.name} />
                            <div className="min-w-0">
                              <p className="font-medium text-white">
                                {e.name}
                                {isSelf && <span className="ml-1.5 font-normal text-slate-500">(você)</span>}
                              </p>
                              <p className="truncate text-xs text-slate-500">{e.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className={table.td}>
                          <Badge tone={e.role === 'ADMIN' ? 'brand' : 'gray'}>
                            {e.role === 'ADMIN' ? 'Admin' : 'Funcionário'}
                          </Badge>
                        </td>
                        <td className={table.td}>
                          {s ? (
                            <div>
                              <p className="text-slate-200">{s.name}</p>
                              <p className="text-xs text-slate-500">
                                {formatDuration(s.dailyMinutes)} · {s.startTime}
                              </p>
                            </div>
                          ) : e.workScheduleId ? (
                            <span className="text-slate-500">…</span>
                          ) : (
                            <Badge tone="amber">Sem jornada</Badge>
                          )}
                        </td>
                        <td className={table.td}>
                          {e.active ? (
                            <Badge tone="green" dot>
                              Ativo
                            </Badge>
                          ) : (
                            <Badge tone="red" dot>
                              Inativo
                            </Badge>
                          )}
                        </td>
                        <td className={cn(table.td, 'whitespace-nowrap text-slate-400 tabular-nums')}>
                          {formatDate(e.createdAt.slice(0, 10))}
                        </td>
                        <td className={table.td}>
                          <div className="flex items-center justify-end gap-0.5">
                            <Link
                              to={`/registros?funcionario=${e.id}`}
                              title="Ver registros"
                              aria-label="Ver registros"
                              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-brand-500/10 hover:text-brand-300"
                            >
                              <CalendarDays className="size-4" />
                            </Link>
                            <IconAction label="Editar" icon={Pencil} onClick={() => setEditing(e)} />
                            <IconAction label="Redefinir senha" icon={KeyRound} onClick={() => setResetting(e)} />
                            {!isSelf && (
                              <IconAction
                                label={e.active ? 'Desativar acesso' : 'Reativar acesso'}
                                icon={Power}
                                danger={e.active}
                                onClick={() => toggleActive(e)}
                                disabled={setActive.isPending && setActive.variables?.id === e.id}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={employees.data.meta.page}
            totalPages={employees.data.meta.totalPages}
            total={employees.data.meta.total}
            onChange={(page) => setFilters((f) => ({ ...f, page }))}
          />
        </Card>
      )}

      {editing && (
        <EmployeeFormModal employee={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
      {resetting && <ResetPasswordModal employee={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}
