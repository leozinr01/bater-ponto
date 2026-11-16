import { useEffect, useState } from 'react';
import { useEmployees } from '../lib/queries';
import { Input, Select } from './ui';

const PAGE_SIZE = 100;

/**
 * Seletor de funcionário para administradores. Lista só funcionários: o administrador
 * não bate ponto, então não tem folha. Sem escolha, já seleciona o primeiro da lista.
 */
export function EmployeePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (employeeId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const employees = useEmployees({ search: debounced || undefined, role: 'EMPLOYEE', pageSize: PAGE_SIZE });
  const list = employees.data?.data ?? [];
  // A busca só aparece quando nem todos cabem na lista
  const needsSearch = debounced !== '' || (employees.data?.meta.total ?? 0) > PAGE_SIZE;
  const selectedMissing = value && !list.some((e) => e.id === value);

  const first = list[0]?.id;
  useEffect(() => {
    if (!value && first && !debounced) onChange(first);
  }, [value, first, debounced, onChange]);

  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
      {needsSearch && (
        <Input
          type="search"
          placeholder="Buscar funcionário"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-44"
          aria-label="Buscar funcionário"
        />
      )}
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full sm:w-56"
        aria-label="Funcionário"
      >
        {!value && <option value="">{employees.isPending ? 'Carregando…' : 'Nenhum funcionário'}</option>}
        {selectedMissing && <option value={value}>Funcionário selecionado</option>}
        {list.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {e.active ? '' : ' (inativo)'}
          </option>
        ))}
      </Select>
    </div>
  );
}
