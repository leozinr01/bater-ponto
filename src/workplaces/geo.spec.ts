import {
  distanceMeters,
  evaluateLocation,
  MAX_ACCURACY_SLACK_METERS,
  parseDeviceLocation,
  WorkplaceArea,
} from './geo';

// Praça da Sé, São Paulo
const SE = { latitude: -23.55052, longitude: -46.633308 };
/** Ponto a `meters` ao norte da Sé (1° de latitude ≈ 111,2 km). */
const north = (meters: number) => ({
  latitude: SE.latitude + meters / 111_195,
  longitude: SE.longitude,
});

const office: WorkplaceArea = { name: 'Matriz', radiusMeters: 150, ...SE };

describe('distanceMeters', () => {
  it('mede distâncias curtas com precisão de metro', () => {
    expect(distanceMeters(SE, north(500))).toBeCloseTo(500, 0);
    expect(distanceMeters(SE, SE)).toBe(0);
  });

  it('mede a distância entre cidades', () => {
    const rio = { latitude: -22.906847, longitude: -43.172897 };
    expect(distanceMeters(SE, rio) / 1000).toBeCloseTo(361, -1);
  });
});

describe('evaluateLocation', () => {
  const at = (meters: number, accuracyMeters: number | null = 10) => ({
    ...north(meters),
    accuracyMeters,
  });

  it('sem localização = UNAVAILABLE', () => {
    expect(evaluateLocation(null, [office])).toEqual({
      status: 'UNAVAILABLE',
      workplaceName: null,
      distanceMeters: null,
    });
  });

  it('sem local cadastrado não avalia', () => {
    expect(evaluateLocation(at(10), []).status).toBeNull();
  });

  it('dentro do raio = INSIDE, com o local e a distância', () => {
    expect(evaluateLocation(at(100), [office])).toEqual({
      status: 'INSIDE',
      workplaceName: 'Matriz',
      distanceMeters: 100,
    });
  });

  it('longe do raio = OUTSIDE, com o local mais próximo', () => {
    const branch = { ...office, name: 'Filial', ...north(5000) };
    expect(evaluateLocation(at(3000), [office, branch])).toEqual({
      status: 'OUTSIDE',
      workplaceName: 'Filial',
      distanceMeters: 2000,
    });
  });

  it('desconta a margem de erro do GPS, até o limite', () => {
    expect(evaluateLocation(at(200, 60), [office]).status).toBe('INSIDE');
    expect(evaluateLocation(at(200, 40), [office]).status).toBe('OUTSIDE');
    // Margem enorme (localização só pela rede) não vira "no local"
    expect(
      evaluateLocation(at(150 + MAX_ACCURACY_SLACK_METERS + 50, 5000), [office])
        .status,
    ).toBe('OUTSIDE');
  });

  it('basta estar no raio de um dos locais', () => {
    const branch = { ...office, name: 'Filial', ...north(1000) };
    expect(evaluateLocation(at(950), [office, branch])).toMatchObject({
      status: 'INSIDE',
      workplaceName: 'Filial',
    });
  });
});

describe('parseDeviceLocation', () => {
  it('lê latitude, longitude e precisão', () => {
    expect(
      parseDeviceLocation({ latitude: -23.5, longitude: -46.6, accuracy: 12 }),
    ).toEqual({ latitude: -23.5, longitude: -46.6, accuracyMeters: 12 });
  });

  it.each([
    undefined,
    null,
    {},
    { latitude: '-23.5', longitude: -46.6 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: NaN, longitude: 0 },
  ])('valor inválido vira sem localização: %j', (body) => {
    expect(parseDeviceLocation(body)).toBeNull();
  });

  it('ignora precisão inválida', () => {
    expect(
      parseDeviceLocation({ latitude: 0, longitude: 0, accuracy: -1 }),
    ).toEqual({ latitude: 0, longitude: 0, accuracyMeters: null });
  });
});
