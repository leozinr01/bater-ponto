import { useEffect, useState } from 'react';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  /** Margem de erro informada pelo aparelho, em metros. */
  accuracy: number;
}

/** Por que o aparelho não entregou a localização. */
export type LocationProblem = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout';

export type LocationResult = { location: DeviceLocation; problem: null } | { location: null; problem: LocationProblem };

/** Tempo máximo esperando o GPS: depois disso o ponto é registrado sem localização. */
const LOCATION_TIMEOUT_MS = 10_000;

/** Posição recente reaproveitada na marcação: a tela de ponto já liga o GPS ao abrir. */
const MAX_POSITION_AGE_MS = 30_000;

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: LOCATION_TIMEOUT_MS,
  maximumAge: MAX_POSITION_AGE_MS,
};

/**
 * Localização atual do aparelho, só no momento da marcação (não há rastreamento).
 * Nunca falha: permissão negada, sem GPS ou demora resultam em location null com o motivo,
 * e o ponto é registrado mesmo assim, com o alerta "sem localização".
 */
export function locateDevice(): Promise<LocationResult> {
  // Navegadores só liberam a localização em HTTPS (ou localhost)
  if (!window.isSecureContext) return Promise.resolve({ location: null, problem: 'insecure' });
  if (!('geolocation' in navigator)) return Promise.resolve({ location: null, problem: 'unsupported' });
  return new Promise((resolve) => {
    // Alguns navegadores não chamam nenhum callback quando a permissão fica pendente
    const fallback = setTimeout(() => resolve({ location: null, problem: 'timeout' }), LOCATION_TIMEOUT_MS + 1000);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(fallback);
        resolve({
          location: { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy },
          problem: null,
        });
      },
      (error) => {
        clearTimeout(fallback);
        const problem =
          error.code === error.PERMISSION_DENIED ? 'denied' : error.code === error.TIMEOUT ? 'timeout' : 'unavailable';
        resolve({ location: null, problem });
      },
      POSITION_OPTIONS,
    );
  });
}

/** Explicação para o usuário de por que a localização não veio. */
export function locationProblemMessage(problem: LocationProblem) {
  switch (problem) {
    case 'insecure':
      return 'O navegador só libera a localização em sites com HTTPS.';
    case 'unsupported':
      return 'Este navegador não informa a localização.';
    case 'denied':
      return 'O acesso à localização está bloqueado. Permita nas configurações do navegador (ícone ao lado do endereço do site).';
    case 'timeout':
      return 'O GPS demorou para responder. Confira se a localização do aparelho está ligada.';
    case 'unavailable':
      return 'Não foi possível obter a localização. Confira se o GPS/localização do aparelho está ligado.';
  }
}

export type LocationPermission = PermissionState | 'unknown';

/**
 * Prepara a localização enquanto a tela de ponto está aberta: pede a permissão logo de cara
 * (em vez de no meio da batida) e deixa uma posição recente pronta, para a marcação não esperar o GPS.
 * Também acompanha a permissão, para avisar antes da batida se ela estiver bloqueada.
 */
export function useLocationWarmUp(): LocationPermission {
  const [permission, setPermission] = useState<LocationPermission>('unknown');

  useEffect(() => {
    if (!window.isSecureContext || !('geolocation' in navigator)) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const update = () => status && setPermission(status.state);

    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((result) => {
        if (cancelled) return;
        status = result;
        update();
        result.addEventListener('change', update);
      })
      .catch(() => {});

    const warmUp = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.geolocation.getCurrentPosition(
        () => setPermission((p) => (p === 'unknown' ? 'granted' : p)),
        (error) => error.code === error.PERMISSION_DENIED && setPermission('denied'),
        POSITION_OPTIONS,
      );
    };
    // Só ao abrir a tela e ao voltar para ela (nada é enviado ao servidor): sem rastreamento contínuo
    warmUp();
    document.addEventListener('visibilitychange', warmUp);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', warmUp);
      status?.removeEventListener('change', update);
    };
  }, []);

  return permission;
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
