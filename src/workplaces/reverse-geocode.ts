import { EnvService } from '@/infra/env/env.service';
import { Injectable, Logger } from '@nestjs/common';
import { GeoPoint } from './geo';

/** Resposta do Nominatim (OpenStreetMap) no formato jsonv2, só os campos usados. */
interface NominatimResult {
  display_name?: string;
  address?: Record<string, string>;
}

/**
 * "Rua X, 123 - Bairro, Cidade/SP" a partir do endereço do Nominatim.
 * Sem rua, usa o nome completo devolvido pelo serviço.
 */
export function formatAddress(result: NominatimResult): string | null {
  const a = result.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.footway ?? a.path;
  const district = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district;
  const city = a.city ?? a.town ?? a.village ?? a.municipality;
  const uf = a['ISO3166-2-lvl4']?.split('-')[1];
  if (!street) return result.display_name?.slice(0, 300) ?? null;
  const first = a.house_number ? `${street}, ${a.house_number}` : street;
  const place = city ? (uf ? `${city}/${uf}` : city) : undefined;
  return [first, district, place].filter(Boolean).join(' - ').slice(0, 300);
}

const TIMEOUT_MS = 2_500;
const CACHE_SIZE = 500;

/**
 * Endereço aproximado de uma coordenada, gravado junto com a marcação.
 * Usa o Nominatim (OpenStreetMap): gratuito, com limite de ~1 consulta por segundo.
 * Qualquer falha devolve null: o endereço é só informativo e nunca atrasa nem impede a batida
 * além do tempo limite. Coordenadas próximas (~10 m) reaproveitam o resultado em memória.
 */
@Injectable()
export class ReverseGeocoder {
  private readonly logger = new Logger(ReverseGeocoder.name);
  private readonly cache = new Map<string, string | null>();
  private readonly enabled: boolean;
  private readonly baseUrl: string;

  constructor(env: EnvService) {
    this.enabled = env.get('REVERSE_GEOCODING');
    this.baseUrl = env.get('NOMINATIM_URL');
  }

  async lookup(point: GeoPoint): Promise<string | null> {
    if (!this.enabled) return null;
    const key = `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    try {
      const url = new URL('/reverse', this.baseUrl);
      url.search = new URLSearchParams({
        format: 'jsonv2',
        lat: String(point.latitude),
        lon: String(point.longitude),
        zoom: '18',
        addressdetails: '1',
        'accept-language': 'pt-BR',
      }).toString();
      const res = await fetch(url, {
        // A política de uso do Nominatim exige identificar a aplicação
        headers: { 'User-Agent': 'sistema-de-ponto/1.0 (registro de ponto)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const address = formatAddress((await res.json()) as NominatimResult);
      this.remember(key, address);
      return address;
    } catch (err) {
      this.logger.warn(`Endereço não obtido: ${(err as Error).message}`);
      return null;
    }
  }

  private remember(key: string, value: string | null) {
    if (this.cache.size >= CACHE_SIZE) {
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(key, value);
  }
}
