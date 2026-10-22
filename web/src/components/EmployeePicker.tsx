import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useEmployees } from '../lib/queries';
import { Input, Select } from './ui';

const PAGE_SIZE = 100;

/** Seletor de funcionário para administradores. Valor vazio = o próprio usuário. */
export function EmployeePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (employeeId: string) => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const employees = useEmployees({ search: debounced || undefined, pageSize: PAGE_SIZE });
  const list = employees.data?.data ?? [];
  // A busca só aparece quando nem todos cabem na lista
  const needsSearch = debounced !== '' || (employees.data?.meta.total ?? 0) > PAGE_SIZE;
  const selectedMissing = value && !list.some((e) => e.id === value);

  return (
    <div className="flex gap-2">
      {needsSearch && (
        <Input
          type="search"
          placeholder="Buscar funcionário"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-44"
          aria-label="Buscar funcionário"
        />
      )}
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-56"
        aria-label="Funcionário"
      >
        <option value="">{user?.name} (eu)</option>
        {selectedMissing && <option value={value}>Funcionário selecionado</option>}
        {list
          .filter((e) => e.id !== user?.id)
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.active ? '' : ' (inativo)'}
            </option>
          ))}
      </Select>
    </div>
  );
}
