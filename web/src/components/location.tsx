import { CloudOff, MapPin } from 'lucide-react';
import { formatDistance, mapsUrl } from '../lib/geo';
import type { PunchLocation, TimesheetDay } from '../lib/types';
import { Badge } from './ui';

/** Selo da localização de uma marcação, com link para o mapa quando há coordenadas. */
export function LocationBadge({ location }: { location: PunchLocation }) {
  const { status, workplaceName, distanceMeters, latitude, longitude, accuracyMeters, address } = location;
  const badge =
    status === 'INSIDE' ? (
      <Badge tone="green" dot>
        No local{workplaceName ? `: ${workplaceName}` : ''}
      </Badge>
    ) : status === 'OUTSIDE' ? (
      <Badge tone="red" dot>
        Fora do local
        {distanceMeters !== null && workplaceName ? ` (${formatDistance(distanceMeters)} de ${workplaceName})` : ''}
      </Badge>
    ) : status === 'IMPRECISE' ? (
      <span title="A margem de erro da localização foi grande demais para dizer se estava no local (comum no computador, que é localizado pela rede)">
        <Badge tone="amber" dot>
          Localização imprecisa{accuracyMeters !== null ? ` (±${formatDistance(accuracyMeters)})` : ''}
        </Badge>
      </span>
    ) : status === 'UNAVAILABLE' ? (
      <span title="O aparelho não enviou a localização: permissão negada, GPS desligado ou sem sinal">
        <Badge>Sem localização</Badge>
      </span>
    ) : (
      <Badge>Localização registrada</Badge>
    );

  if (latitude === null || longitude === null) return badge;
  return (
    <span className="inline-flex items-center gap-1.5">
      {badge}
      <a
        href={mapsUrl(latitude, longitude)}
        target="_blank"
        rel="noreferrer"
        title={accuracyMeters !== null ? `Ver no mapa (margem de erro de ${formatDistance(accuracyMeters)})` : 'Ver no mapa'}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand-300 hover:bg-brand-500/10 hover:text-brand-200"
      >
        <MapPin className="size-3 shrink-0" />
        {address ? <span className="max-w-72 truncate">{address}</span> : 'Mapa'}
      </a>
    </span>
  );
}

/** Selo de batida feita sem internet: o horário veio do celular, vale conferir. */
export function OfflineBadge() {
  return (
    <span title="Batida feita sem internet e enviada depois. O horário é o do celular.">
      <Badge tone="amber">
        <CloudOff className="size-3" />
        Offline
      </Badge>
    </span>
  );
}

/** Selos de um dia: marcações fora dos locais de trabalho e batidas feitas sem internet. */
export function DayLocationAlert({ day }: { day: TimesheetDay }) {
  const outside = day.punches.filter((p) => p.locationStatus === 'OUTSIDE').length;
  const offline = day.punches.some((p) => p.offline);
  return (
    <>
      {outside > 0 && (
        <span title="Marcação feita fora dos locais de trabalho. Veja o mapa na aba Marcações.">
          <Badge tone="red">{outside > 1 ? `${outside} fora do local` : 'Fora do local'}</Badge>
        </span>
      )}
      {offline && <OfflineBadge />}
    </>
  );
}
