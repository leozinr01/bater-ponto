/**
 * Avaliação da localização de uma marcação em relação aos locais de trabalho.
 * A localização nunca impede a marcação (Portaria 671 proíbe restringir o registro):
 * ela só gera o alerta "fora do local".
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface DeviceLocation extends GeoPoint {
  /** Margem de erro informada pelo aparelho, em metros. */
  accuracyMeters: number | null;
}

export interface WorkplaceArea extends GeoPoint {
  name: string;
  radiusMeters: number;
}

export type LocationStatus = 'INSIDE' | 'OUTSIDE' | 'UNAVAILABLE';

export interface LocationEvaluation {
  status: LocationStatus | null;
  workplaceName: string | null;
  distanceMeters: number | null;
}

/**
 * Parte da margem de erro do GPS descontada da distância: dentro de prédios o celular
 * costuma errar dezenas de metros, e quem está no local não deve receber alerta por isso.
 * O limite evita que uma localização muito imprecisa (ex.: só pela rede) conte como "no local".
 */
export const MAX_ACCURACY_SLACK_METERS = 100;

const EARTH_RADIUS_METERS = 6_371_000;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Sem localização = UNAVAILABLE; sem local cadastrado = status null (não há o que comparar);
 * senão INSIDE se estiver no raio de algum local, descontada a margem de erro, ou OUTSIDE.
 * O local informado é o mais próximo, com a distância até o centro dele.
 */
export function evaluateLocation(
  location: DeviceLocation | null,
  workplaces: WorkplaceArea[],
): LocationEvaluation {
  if (!location) {
    return { status: 'UNAVAILABLE', workplaceName: null, distanceMeters: null };
  }
  if (workplaces.length === 0) {
    return { status: null, workplaceName: null, distanceMeters: null };
  }

  const slack = Math.min(
    location.accuracyMeters ?? 0,
    MAX_ACCURACY_SLACK_METERS,
  );
  let nearest: { workplace: WorkplaceArea; distance: number } | null = null;
  let inside = false;
  for (const workplace of workplaces) {
    const distance = distanceMeters(location, workplace);
    if (distance - slack <= workplace.radiusMeters) inside = true;
    if (!nearest || distance < nearest.distance) {
      nearest = { workplace, distance };
    }
  }

  return {
    status: inside ? 'INSIDE' : 'OUTSIDE',
    workplaceName: nearest!.workplace.name,
    distanceMeters: Math.round(nearest!.distance),
  };
}

/**
 * Lê a localização enviada pelo app. Valores ausentes ou inválidos viram "sem localização":
 * um aparelho com GPS com defeito não pode impedir a marcação.
 */
export function parseDeviceLocation(body: unknown): DeviceLocation | null {
  if (!body || typeof body !== 'object') return null;
  const { latitude, longitude, accuracy } = body as Record<string, unknown>;
  const isNumber = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);

  if (
    !isNumber(latitude) ||
    !isNumber(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return {
    latitude,
    longitude,
    accuracyMeters: isNumber(accuracy) && accuracy >= 0 ? accuracy : null,
  };
}
