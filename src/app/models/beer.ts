export interface Beer {
  id: string;
  name: string;
  /** Shown in the result line, e.g. "Cara's" */
  resultName: string;
  abv: number;
  /** Price of a 33cl can in euro */
  price: number;
  /** Nightshop price of a can in euro */
  nightshopPrice: number;
  /** Price of a 24-can crate; null = no crate discount known, optimizer just groups per 24 */
  cratePrice: number | null;
  /** Base asset name for the can artwork; renders assets/{image}.png and assets/{image}-small.png */
  image: string;
  /** CSS filter applied to the can image, e.g. to tint a variant that reuses another can's art ('none' when it has its own image) */
  canFilter: string;
}

export interface PriceConfig {
  updated: string;
  beers: Beer[];
}
