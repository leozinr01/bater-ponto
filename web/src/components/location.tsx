import { MapPin } from 'lucide-react';
import { formatDistance, mapsUrl } from '../lib/geo';
import type { PunchLocation, TimesheetDay } from '../lib/types';
import { Badge } from './ui';

/** Selo da localização de uma marcação, com link para o mapa quando há coordenadas. */
export function LocationBadge({ location }: { location: PunchLocation }) {
  const { status, workplaceName, distanceMeters, latitude, longitude, accuracyMeters } = location;
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
        <MapPin className="size-3" />
        Mapa
      </a>
    </span>
  );
}

/** Selo "fora do local" de um dia, quando alguma marcação foi feita fora dos locais de trabalho. */
export function DayLocationAlert({ day }: { day: TimesheetDay }) {
  const outside = day.punches.filter((p) => p.locationStatus === 'OUTSIDE').length;
  if (!outside) return null;
  return (
    <span title="Marcação feita fora dos locais de trabalho. Veja o mapa na aba Marcações.">
      <Badge tone="red">{outside > 1 ? `${outside} fora do local` : 'Fora do local'}</Badge>
    </span>
  );
}
