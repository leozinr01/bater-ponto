import { formatAddress } from './reverse-geocode';

describe('formatAddress', () => {
  it('monta rua, número, bairro e cidade/UF', () => {
    expect(
      formatAddress({
        address: {
          road: 'Avenida Paulista',
          house_number: '1578',
          suburb: 'Bela Vista',
          city: 'São Paulo',
          'ISO3166-2-lvl4': 'BR-SP',
        },
      }),
    ).toBe('Avenida Paulista, 1578 - Bela Vista - São Paulo/SP');
  });

  it('funciona sem número e sem bairro', () => {
    expect(
      formatAddress({ address: { road: 'Rua das Flores', town: 'Gramado' } }),
    ).toBe('Rua das Flores - Gramado');
  });

  it('sem rua usa o nome completo do serviço', () => {
    expect(
      formatAddress({
        display_name: 'Parque Estadual, Campos do Jordão, Brasil',
        address: {},
      }),
    ).toBe('Parque Estadual, Campos do Jordão, Brasil');
  });

  it('sem nada devolve null', () => {
    expect(formatAddress({})).toBeNull();
  });
});
