import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/toast';
import {
  Alert,
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
  Select,
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
      title={isNew ? 'Novo funcionário' : `Editar ${employee.name}`}
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
        <Field label="Nome">
          {(id) => <Input id={id} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="E-mail">
          {(id) => (
            <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        {isNew && (
          <Field label="Senha inicial" hint="Mínimo de 8 caracteres. O funcionário pode trocá-la depois em Minha conta.">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Perfil" hint={isSelf ? 'Você não pode alterar o próprio perfil.' : undefined}>
            {(id) => (
              <Select id={id} value={role} disabled={isSelf} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="EMPLOYEE">Funcionário</option>
                <option value="ADMIN">Administrador</option>
              </Select>
            )}
          </Field>
          <Field label="Jornada">
            {(id) => (
              <Select id={id} value={workScheduleId} onChange={(e) => setWorkScheduleId(e.target.value)}>
                <option value="">Sem jornada</option>
                {schedules.data?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatDuration(s.dailyMinutes)}, {s.startTime})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {!workScheduleId && (
          <p className="text-xs text-slate-500">
            Sem jornada, o espelho calcula as horas trabalhadas, mas não atrasos, extras e faltas.
          </p>
        )}
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

export function EmployeesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
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

  const scheduleName = (id: string | null) =>
    id ? (schedules.data?.data.find((s) => s.id === id)?.name ?? '…') : null;

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
        title="Funcionários"
        description="Funcionários não são excluídos: desative o acesso e os registros são mantidos."
        actions={<Button onClick={() => setEditing('new')}>Novo funcionário</Button>}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <Input
          type="search"
          placeholder="Buscar por nome ou e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72"
        />
        <Select
          value={filters.active === undefined ? '' : String(filters.active)}
          onChange={(e) =>
            setFilters((f) => ({ ...f, page: 1, active: e.target.value === '' ? undefined : e.target.value === 'true' }))
          }
          className="w-auto"
          aria-label="Status"
        >
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="">Todos</option>
        </Select>
        <Select
          value={filters.role ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, page: 1, role: (e.target.value || undefined) as Role }))}
          className="w-auto"
          aria-label="Perfil"
        >
          <option value="">Todos os perfis</option>
          <option value="EMPLOYEE">Funcionários</option>
          <option value="ADMIN">Administradores</option>
        </Select>
      </Card>

      {employees.isPending ? (
        <Loading />
      ) : employees.isError ? (
        <Alert>{errorMessage(employees.error)}</Alert>
      ) : (
        <Card className={cn('overflow-hidden', employees.isFetching && 'opacity-70')}>
          {employees.data.data.length === 0 ? (
            <EmptyState>Nenhum funcionário encontrado.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Perfil</th>
                    <th className="px-4 py-3">Jornada</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Desde</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.data.data.map((e) => {
                    const isSelf = e.id === user?.id;
                    return (
                      <tr key={e.id} className={cn(!e.active && 'text-slate-400')}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {e.name} {isSelf && <span className="font-normal text-slate-400">(você)</span>}
                          </p>
                          <p className="text-xs text-slate-500">{e.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={e.role === 'ADMIN' ? 'indigo' : 'gray'}>
                            {e.role === 'ADMIN' ? 'Admin' : 'Funcionário'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {scheduleName(e.workScheduleId) ?? <span className="text-amber-600">Sem jornada</span>}
                        </td>
                        <td className="px-4 py-3">
                          {e.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                          {formatDate(e.createdAt.slice(0, 10))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1 whitespace-nowrap">
                            <Link
                              to={`/espelho?funcionario=${e.id}`}
                              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                              Espelho
                            </Link>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                              Editar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setResetting(e)}>
                              Senha
                            </Button>
                            {!isSelf && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className={e.active ? 'text-red-600 hover:bg-red-50 hover:text-red-700' : ''}
                                onClick={() => toggleActive(e)}
                                disabled={setActive.isPending && setActive.variables?.id === e.id}
                              >
                                {e.active ? 'Desativar' : 'Reativar'}
                              </Button>
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
