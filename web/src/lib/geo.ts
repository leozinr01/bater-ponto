export interface DeviceLocation {
  latitude: number;
  longitude: number;
  /** Margem de erro informada pelo aparelho, em metros. */
  accuracy: number;
}

/** Tempo máximo esperando o GPS: depois disso o ponto é registrado sem localização. */
const LOCATION_TIMEOUT_MS = 10_000;

/**
 * Localização atual do aparelho, só no momento da marcação (não há rastreamento).
 * Nunca falha: permissão negada, sem GPS ou demora resultam em null, e o ponto é
 * registrado mesmo assim, com o alerta "sem localização".
 */
export function getDeviceLocation(): Promise<DeviceLocation | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    // Alguns navegadores não chamam nenhum callback quando a permissão fica pendente
    const fallback = setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS + 1000);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(fallback);
        resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy });
      },
      () => {
        clearTimeout(fallback);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 30_000 },
    );
  });
}

/** Link para ver o ponto no mapa. */
export function mapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/** "350 m" ou "8,2 km". */
export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: meters < 10_000 ? 1 : 0 })} km`;
}
