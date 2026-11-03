import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDistance, locateDevice, resetLastPosition } from './geo';

const coords = (latitude: number, longitude: number, accuracy = 10) =>
  ({ latitude, longitude, accuracy }) as GeolocationCoordinates;

const ERROR_CODES = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };

/** GPS falso: cada chamada responde com o próximo item da lista. */
function mockGeolocation(responses: Array<GeolocationCoordinates | number>) {
  const getCurrentPosition = vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
    const next = responses.shift()!;
    if (typeof next === 'number') error({ code: next, message: '', ...ERROR_CODES } as GeolocationPositionError);
    else success({ coords: next, timestamp: Date.now() } as GeolocationPosition);
  });
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
  return getCurrentPosition;
}

describe('locateDevice', () => {
  beforeEach(() => {
    resetLastPosition();
    vi.stubGlobal('isSecureContext', true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reaproveita a posição dos últimos 30 s sem ligar o GPS de novo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const gps = mockGeolocation([coords(-22.89695, -43.54936), coords(-22.9, -43.55)]);

    const first = await locateDevice();
    vi.advanceTimersByTime(20_000);
    const second = await locateDevice();

    expect(gps).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second.location?.latitude).toBe(-22.89695);
  });

  it('busca de novo depois de 30 s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const gps = mockGeolocation([coords(-22.89695, -43.54936), coords(-22.9, -43.55)]);

    await locateDevice();
    vi.advanceTimersByTime(31_000);
    const later = await locateDevice();

    expect(gps).toHaveBeenCalledTimes(2);
    expect(later.location?.latitude).toBe(-22.9);
  });

  it.each([
    [ERROR_CODES.PERMISSION_DENIED, 'denied'],
    [ERROR_CODES.POSITION_UNAVAILABLE, 'unavailable'],
    [ERROR_CODES.TIMEOUT, 'timeout'],
  ])('erro %i do GPS vira o motivo "%s", sem falhar', async (code, problem) => {
    mockGeolocation([code]);
    expect(await locateDevice()).toEqual({ location: null, problem });
  });

  it('sem HTTPS nem tenta o GPS', async () => {
    vi.stubGlobal('isSecureContext', false);
    const gps = mockGeolocation([coords(0, 0)]);

    expect(await locateDevice()).toEqual({ location: null, problem: 'insecure' });
    expect(gps).not.toHaveBeenCalled();
  });
});

describe('formatDistance', () => {
  it('metros até 1 km, depois km com vírgula', () => {
    expect(formatDistance(349.6)).toBe('350 m');
    expect(formatDistance(8_240)).toBe('8,2 km');
    expect(formatDistance(12_600)).toBe('13 km');
  });
});
