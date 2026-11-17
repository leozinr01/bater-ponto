import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPeriod, PeriodPicker } from './PeriodPicker';

describe('PeriodPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T12:00:00-03:00'));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('escolhe o dia de início e o de fim no calendário', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PeriodPicker month="2026-11" period={null} onChange={onChange} />);

    await user.click(screen.getByTitle('Escolher o período no calendário'));
    // Dias depois de hoje não podem ser escolhidos
    expect((screen.getByLabelText('18/11/2026') as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByLabelText('03/11/2026'));
    await user.click(screen.getByLabelText('10/11/2026'));
    expect(screen.getByText(/03\/11 a 10\/11 · 8 dias/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onChange).toHaveBeenCalledWith({
      month: '2026-11',
      period: { from: '2026-11-03', to: '2026-11-10' },
    });
  });

  it('com período escolhido, a seta volta para o mês inteiro', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PeriodPicker
        month="2026-11"
        period={{ from: '2026-10-20', to: '2026-11-05' }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('20/10 – 05/11')).toBeTruthy();

    await user.click(screen.getByLabelText('Mês anterior'));
    expect(onChange).toHaveBeenCalledWith({ month: '2026-09', period: null });
  });

  it('mostra o ano quando o período não é do ano atual', () => {
    expect(formatPeriod({ from: '2025-12-20', to: '2026-01-10' })).toBe('20/12/2025 – 10/01/2026');
  });
});
