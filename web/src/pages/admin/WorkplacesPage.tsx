import { Crosshair, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useToast } from '../../components/toast';
import { Alert, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatDistance, getDeviceLocation, mapsUrl } from '../../lib/geo';
import { useDeleteWorkplace, useSaveWorkplace, useWorkplaces } from '../../lib/queries';
import type { Workplace } from '../../lib/types';

const DEFAULT_RADIUS = 150;

/** Lê "-23.55052, -46.633308", o formato que o Google Maps copia ao clicar com o botão direito. */
function parseCoordinates(value: string): { latitude: number; longitude: number } | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

const formatCoordinates = (latitude: number, longitude: number) => `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

function WorkplaceFormModal({ workplace, onClose }: { workplace: Workplace | null; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveWorkplace();
  const [name, setName] = useState(workplace?.name ?? '');
  const [coordinates, setCoordinates] = useState(
    workplace ? formatCoordinates(workplace.latitude, workplace.longitude) : '',
  );
  const [radius, setRadius] = useState(String(workplace?.radiusMeters ?? DEFAULT_RADIUS));
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const parsed = parseCoordinates(coordinates);

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocateError(null);
    const location = await getDeviceLocation();
    setLocating(false);
    if (!location) {
      setLocateError('Não foi possível obter a localização. Permita o acesso no navegador ou cole as coordenadas.');
      return;
    }
    setCoordinates(formatCoordinates(location.latitude, location.longitude));
    if (location.accuracy > 100) {
      setLocateError(
        `Localização imprecisa (margem de ${formatDistance(location.accuracy)}). Confira no mapa ou use o celular no local.`,
      );
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    save.mutate(
      { id: workplace?.id, name: name.trim(), ...parsed, radiusMeters: Number(radius) },
      {
        onSuccess: () => {
          toast(workplace ? 'Local atualizado.' : 'Local cadastrado.');
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={MapPin}
      title={workplace ? `Editar ${workplace.name}` : 'Novo local de trabalho'}
      description="Marcações longe de todos os locais recebem o alerta “fora do local”. Nenhuma marcação é recusada."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="workplace-form" loading={save.isPending} disabled={!parsed}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="workplace-form" onSubmit={onSubmit} className="space-y-5">
        {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
        <Field label="Nome">
          {(id) => (
            <Input
              id={id}
              required
              maxLength={80}
              placeholder="Ex: Matriz, Filial Centro"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Coordenadas"
          hint="No Google Maps, clique com o botão direito no local e clique nas coordenadas para copiar. Ou, estando no local, use a sua localização atual."
        >
          {(id) => (
            <div className="space-y-2">
              <Input
                id={id}
                required
                inputMode="decimal"
                placeholder="-23.550520, -46.633308"
                value={coordinates}
                onChange={(e) => setCoordinates(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="secondary" icon={Crosshair} loading={locating} onClick={useCurrentLocation}>
                  Usar minha localização atual
                </Button>
                {parsed && (
                  <a
                    href={mapsUrl(parsed.latitude, parsed.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-brand-300 hover:text-brand-200"
                  >
                    Conferir no mapa
                  </a>
                )}
              </div>
              {coordinates && !parsed && <p className="text-xs text-red-300">Use o formato latitude, longitude.</p>}
              {locateError && <p className="text-xs text-amber-300">{locateError}</p>}
            </div>
          )}
        </Field>
        <Field
          label="Raio (metros)"
          hint="Distância do ponto central que ainda conta como “no local”. 100 a 200 m funciona para a maioria dos prédios."
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              required
              min={30}
              max={5000}
              step={10}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

function DeleteWorkplaceModal({ workplace, onClose }: { workplace: Workplace; onClose: () => void }) {
  const toast = useToast();
  const remove = useDeleteWorkplace();
  return (
    <Modal
      open
      onClose={onClose}
      icon={Trash2}
      title={`Remover ${workplace.name}?`}
      description="As marcações já feitas não mudam. As próximas deixam de ser comparadas com este local."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(workplace.id, {
                onSuccess: () => {
                  toast('Local removido.');
                  onClose();
                },
              })
            }
          >
            Remover
          </Button>
        </>
      }
    >
      {remove.isError ? <Alert>{errorMessage(remove.error)}</Alert> : null}
    </Modal>
  );
}

export function WorkplacesPage() {
  const workplaces = useWorkplaces();
  const [editing, setEditing] = useState<Workplace | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Workplace | null>(null);

  return (
    <>
      <PageHeader
        icon={MapPin}
        title="Locais de trabalho"
        description="A localização é registrada em cada marcação. Fora do raio de todos os locais, a marcação vale normalmente, mas recebe o alerta “fora do local”."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Novo local
          </Button>
        }
      />

      {workplaces.isPending ? (
        <Loading rows={3} />
      ) : workplaces.isError ? (
        <Alert>{errorMessage(workplaces.error)}</Alert>
      ) : workplaces.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={MapPin}
            action={
              <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
                Cadastrar local
              </Button>
            }
          >
            Nenhum local cadastrado. As marcações guardam a localização, mas ainda não há com o que comparar.
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-white/[0.04]">
            {workplaces.data.map((w) => (
              <li key={w.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-200 ring-1 ring-white/[0.08]">
                  <MapPin className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{w.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    Raio de {formatDistance(w.radiusMeters)} ·{' '}
                    <a
                      href={mapsUrl(w.latitude, w.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-300 hover:text-brand-200"
                    >
                      ver no mapa
                    </a>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(w)}
                  title="Editar local"
                  aria-label={`Editar ${w.name}`}
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(w)}
                  title="Remover local"
                  aria-label={`Remover ${w.name}`}
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-xs text-slate-500">
        O GPS do celular informa a própria margem de erro, e até 100 m dela é descontada: quem está dentro do prédio não
        recebe alerta por imprecisão. No computador a localização costuma ser bem menos precisa.
      </p>

      {editing && <WorkplaceFormModal workplace={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteWorkplaceModal workplace={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
