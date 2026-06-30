import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonLabel,
  IonRow,
  IonSegment,
  IonSegmentButton,
  ToastController,
} from '@ionic/angular/standalone';
import { Share } from '@capacitor/share';
import { addIcons } from 'ionicons';
import { logoEuro, moon, shareSocial, sunny, beer } from 'ionicons/icons';
import { PriceService } from '../services/price.service';

const LITRES_PER_CAN = 0.33;
const CANS_PER_CRATE = 24;
const MAX_MONEY = 1_000_000_000;
const CAN_HEIGHT_M = 0.115;
const CAN_WEIGHT_KG = 0.35;
const MANNEKEN_PIS_M = 0.61;
const ATOMIUM_M = 102;
const BATHTUB_L = 150;

const RANKS: { min: number; title: string }[] = [
  { min: 1000, title: 'Cara Baron 👑' },
  { min: 240, title: 'Nightshop Nemesis' },
  { min: 100, title: 'Kotbaas' },
  { min: 48, title: 'Kotfeestje' },
  { min: 24, title: 'Bakske Vol' },
  { min: 12, title: 'Halve Bak' },
  { min: 6, title: 'Sixpack Soldier' },
  { min: 1, title: 'Proever' },
  { min: 0, title: 'Spaarvarken 😢' },
];

/** Your Ko-fi / PayPal page — the "Buy me a Cara" button links here. */
const TIP_JAR_URL = 'https://ko-fi.com/caraconverter';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonIcon,
    IonInput,
    IonLabel,
    IonRow,
    IonSegment,
    IonSegmentButton,
  ],
})
export class HomePage {
  private readonly prices = inject(PriceService);
  private readonly toast = inject(ToastController);

  readonly tipJarUrl = TIP_JAR_URL;

  inputValue = '';
  readonly beers = this.prices.beers;
  readonly selectedBeerId = signal('pils');
  readonly nightshop = signal(false);
  readonly amount = signal<number | null>(null);
  readonly inputError = signal<string | null>(null);

  private readonly content = viewChild(IonContent);

  readonly selectedBeer = computed(
    () => this.beers().find((b) => b.id === this.selectedBeerId()) ?? this.beers()[0],
  );

  readonly canPrice = computed(() =>
    this.nightshop() ? this.selectedBeer().nightshopPrice : this.selectedBeer().price,
  );

  readonly caraCount = computed(() => {
    const money = this.amount();
    if (money === null) {
      return null;
    }
    return Math.floor(money / this.canPrice());
  });

  readonly litres = computed(() => {
    const count = this.caraCount();
    if (count === null) {
      return null;
    }
    return Math.round(count * LITRES_PER_CAN * 100) / 100;
  });

  // Crate math. With a known crate price we check whether crates buy more cans
  // in total; without one we just group the cans per 24. Nightshops don't sell
  // crates, so the optimizer is hidden in nightshop mode.
  readonly crates = computed(() => {
    const money = this.amount();
    const count = this.caraCount();
    if (money === null || count === null || count < CANS_PER_CRATE || this.nightshop()) {
      return null;
    }
    const cratePrice = this.selectedBeer().cratePrice;
    if (cratePrice === null || cratePrice >= CANS_PER_CRATE * this.canPrice()) {
      return { crates: Math.floor(count / CANS_PER_CRATE), loose: count % CANS_PER_CRATE, total: count };
    }
    const crates = Math.floor(money / cratePrice);
    const loose = Math.floor((money - crates * cratePrice) / this.canPrice());
    return { crates, loose, total: crates * CANS_PER_CRATE + loose };
  });

  readonly rank = computed(() => {
    const count = this.caraCount();
    if (count === null) {
      return null;
    }
    return RANKS.find((r) => count >= r.min)?.title ?? null;
  });

  readonly gagStats = computed(() => {
    const count = this.caraCount();
    const litres = this.litres();
    if (count === null || litres === null || count === 0) {
      return [];
    }
    const stats: string[] = [];
    const height = count * CAN_HEIGHT_M;
    if (height < MANNEKEN_PIS_M) {
      stats.push(`stacked: ${Math.round(height * 100)} cm — Manneken Pis looks down on you`);
    } else if (height < ATOMIUM_M) {
      stats.push(`stacked: ${this.format(Math.round(height * 10) / 10)} m = ${this.format(Math.floor(height / MANNEKEN_PIS_M))}× Manneken Pis`);
    } else {
      stats.push(`stacked: ${this.format(Math.round(height))} m = ${this.format(Math.round((height / ATOMIUM_M) * 10) / 10)}× the Atomium`);
    }
    const weight = count * CAN_WEIGHT_KG;
    stats.push(`${this.format(weight < 10 ? Math.round(weight * 10) / 10 : Math.round(weight))} kg to carry home`);
    if (litres >= BATHTUB_L / 2) {
      stats.push(`${this.format(Math.round((litres / BATHTUB_L) * 10) / 10)} bathtubs of Cara`);
    }
    return stats;
  });

  // Cans stack into the classic student beer-can pyramid: top row 1 can,
  // bottom row `base` cans. Whatever doesn't fit a full pyramid starts the
  // next one. Cans shrink so the bottom row always fits the screen.
  readonly pyramid = computed(() => {
    const count = this.caraCount();
    if (count === null || count === 0 || count >= 1000) {
      return null;
    }
    const base = Math.floor((Math.sqrt(8 * count + 1) - 1) / 2);
    const rows = Array.from({ length: base }, (_, i) => Array.from({ length: i + 1 }));
    const leftover = count - (base * (base + 1)) / 2;
    const canWidth = Math.max(7, Math.min(24, Math.floor(330 / Math.max(base, leftover))));
    return { rows, leftover: Array.from({ length: leftover }), canWidth };
  });

  // 1000+ cans: one can per decimal digit (x4, x60, x500, ...), stacked into
  // pyramid rows of 1, 2, 3... — smallest on top, biggest at the base.
  readonly digitPyramid = computed(() => {
    const count = this.caraCount();
    if (count === null || count < 1000) {
      return [];
    }
    const groups = count
      .toString()
      .split('')
      .reverse()
      .map((digit, index) => Number(digit) * 10 ** index)
      .filter((value) => value > 0);
    const rows: number[][] = [];
    for (let size = 1; groups.length > 0; size++) {
      rows.push(groups.splice(0, size));
    }
    return rows;
  });

  private readonly intFormat = new Intl.NumberFormat('nl-BE');
  private readonly decFormat = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 });

  constructor() {
    addIcons({ logoEuro, moon, shareSocial, sunny, beer });

    // Auto-scroll the result into view the moment it first appears. Live typing
    // (onMoneyInput) renders the result below the input, where it sits under the
    // keyboard on phones. Fire only on the no-result → result transition so it
    // doesn't yank the page on every keystroke once the result is already showing.
    let hadResult = false;
    effect(() => {
      const hasResult = this.caraCount() !== null;
      if (hasResult && !hadResult) {
        this.scrollResultIntoView();
      }
      hadResult = hasResult;
    });
  }

  // ion-content scrolls via its own shadow-DOM scroll element, so a plain
  // scrollIntoView() on the slotted banner does nothing. Drive the scroll
  // element directly and stop just below the sticky header.
  private async scrollResultIntoView() {
    const content = this.content();
    if (!content) {
      return;
    }
    // Let Angular render the result row before we measure it.
    setTimeout(async () => {
      const banner = document.querySelector('.result-banner');
      if (!banner) {
        return;
      }
      const scrollEl = await content.getScrollElement();
      const bannerRect = banner.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      const HEADER = 70; // clear the 56px sticky header + a little breathing room
      const topInView = bannerRect.top - scrollRect.top;
      // Already comfortably visible (e.g. a tall desktop window)? Leave it be —
      // no point yanking the page when the result is right there.
      if (topInView >= HEADER && bannerRect.bottom <= scrollRect.top + scrollEl.clientHeight) {
        return;
      }
      // Smooth scrolling (scrollTo({behavior:'smooth'}) or scroll-behavior:smooth)
      // is a no-op on Ionic's scroll element in some webviews; an instant
      // scrollTop assignment is reliable everywhere.
      scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop + topInView - HEADER);
    }, 80);
  }

  format(value: number): string {
    return Number.isInteger(value) ? this.intFormat.format(value) : this.decFormat.format(value);
  }

  // Live conversion as you type — there is no Convert button. Number()
  // rejects half-parseable garbage ("1.000,50" → NaN) where parseFloat would
  // silently return 1. Cap at €1 billion: beyond that the math stops being a
  // joke and starts being a float-precision bug.
  onMoneyInput() {
    const raw = this.inputValue.trim();
    if (!raw) {
      this.amount.set(null);
      this.inputError.set(null);
      return;
    }
    const money = Number(raw.replace(',', '.'));
    if (!Number.isFinite(money) || money < 0) {
      this.amount.set(null);
      this.inputError.set("that's not money 🤨");
      return;
    }
    if (money > MAX_MONEY) {
      this.amount.set(null);
      this.inputError.set('rustig aan, Cara Baron — max €1 billion. Even Colruyt has limits. 🍺');
      return;
    }
    this.inputError.set(null);
    this.amount.set(money);
  }

  // Enter key: re-scroll the result into view (the effect only fires on the
  // first appearance, so this covers editing the amount after a result shows).
  calculateCara() {
    if (this.amount() !== null) {
      this.scrollResultIntoView();
    }
  }

  selectBeer(id: string | number | undefined) {
    if (typeof id === 'string') {
      this.selectedBeerId.set(id);
    }
  }

  toggleNightshop() {
    this.nightshop.update((value) => !value);
  }

  async shareResult() {
    const count = this.caraCount();
    if (count === null) {
      return;
    }
    const beerName = this.selectedBeer().resultName;
    const rank = this.rank();
    const text = `💶 €${this.format(this.amount()!)} = ${this.format(count)} ${beerName} (${this.format(this.litres()!)}L) 🍺 Rank: ${rank} — Converted with CaraConverter`;
    try {
      await Share.share({ text });
    } catch {
      // Share dialog unavailable (or dismissed): copy to clipboard instead.
      try {
        await navigator.clipboard.writeText(text);
        const toast = await this.toast.create({
          message: 'Copied to clipboard!',
          duration: 1500,
          position: 'bottom',
        });
        await toast.present();
      } catch {
        // User cancelled — nothing to do.
      }
    }
  }
}
