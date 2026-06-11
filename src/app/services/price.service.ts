import { Injectable, signal } from '@angular/core';
import { Beer, PriceConfig } from '../models/beer';

/**
 * Optional remote price config. Host a JSON file matching PriceConfig
 * (see prices.example.json in the repo root) and put its raw URL here,
 * e.g. 'https://raw.githubusercontent.com/<you>/caraconverter/main/prices.json'.
 * Leave empty to use the bundled defaults only.
 */
const REMOTE_PRICES_URL: string = '';

/** Last verified: classic can €0.39 (2024). Crate prices are estimates — fix via remote config. */
const DEFAULT_BEERS: Beer[] = [
  {
    id: 'pils',
    name: 'Pils',
    resultName: "Cara's",
    abv: 4.4,
    price: 0.39,
    nightshopPrice: 0.6,
    cratePrice: null,
    canFilter: 'none',
  },
  {
    id: 'blond',
    name: 'Blond',
    resultName: "Cara Blond's",
    abv: 8.5,
    price: 0.52,
    nightshopPrice: 0.8,
    cratePrice: null,
    canFilter: 'sepia(0.5) saturate(1.6) brightness(1.08)',
  },
  {
    id: 'rouge',
    name: 'Rouge',
    resultName: "Cara Rouge's",
    abv: 7.5,
    price: 0.69,
    nightshopPrice: 1.0,
    cratePrice: null,
    canFilter: 'hue-rotate(-35deg) saturate(1.8)',
  },
  {
    id: 'zero',
    name: '0.0',
    resultName: "Cara 0.0's",
    abv: 0,
    price: 0.49,
    nightshopPrice: 0.75,
    cratePrice: null,
    canFilter: 'grayscale(0.85) brightness(1.12)',
  },
];

@Injectable({ providedIn: 'root' })
export class PriceService {
  readonly beers = signal<Beer[]>(DEFAULT_BEERS);

  constructor() {
    this.loadRemotePrices();
  }

  private async loadRemotePrices() {
    if (!REMOTE_PRICES_URL || !REMOTE_PRICES_URL.startsWith('https://')) {
      return;
    }
    try {
      const response = await fetch(REMOTE_PRICES_URL, { cache: 'no-cache' });
      if (!response.ok) {
        return;
      }
      const config: PriceConfig = await response.json();
      const beers = this.sanitize(config);
      if (beers.length > 0) {
        this.beers.set(beers);
      }
    } catch {
      // Offline or bad config: keep bundled defaults.
    }
  }

  /**
   * The remote config is untrusted input: type-check every field, clamp
   * numbers to sane ranges, and cap string lengths before it reaches the UI.
   */
  private sanitize(config: PriceConfig): Beer[] {
    if (!config || !Array.isArray(config.beers)) {
      return [];
    }
    const text = (value: unknown, max: number) =>
      typeof value === 'string' ? value.slice(0, max) : null;
    const price = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0.01 && value <= 100
        ? value
        : null;
    return config.beers
      .slice(0, 12)
      .map((b): Beer | null => {
        const id = text(b?.id, 24);
        const name = text(b?.name, 24);
        const resultName = text(b?.resultName, 32);
        const canPrice = price(b?.price);
        const nightshopPrice = price(b?.nightshopPrice);
        if (!id || !name || !resultName || canPrice === null || nightshopPrice === null) {
          return null;
        }
        const abv =
          typeof b.abv === 'number' && Number.isFinite(b.abv) && b.abv >= 0 && b.abv <= 15
            ? b.abv
            : 0;
        const cratePrice =
          typeof b.cratePrice === 'number' ? price(b.cratePrice) : null;
        // Only allow the filter functions we actually use — this string ends
        // up in a style binding, so keep it on a tight leash.
        const rawFilter = text(b.canFilter, 120) ?? 'none';
        const canFilter = /^(none|((sepia|saturate|brightness|grayscale|hue-rotate)\((-?[\d.]+)(deg)?\)\s*)+)$/.test(
          rawFilter,
        )
          ? rawFilter
          : 'none';
        return { id, name, resultName, abv, price: canPrice, nightshopPrice, cratePrice, canFilter };
      })
      .filter((b): b is Beer => b !== null);
  }
}
