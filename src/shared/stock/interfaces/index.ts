export interface PriceBoardItem {
  symbol: string;
  time: string;
  exchange: string;
  ceiling_price: number;
  floor_price: number;
  reference_price: number;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  average_price: number;
  volume_accumulated: number;
  total_value: number;
  price_change: number;
  percent_change: number;
  bid_price_1: string;
  bid_vol_1: number;
  bid_price_2: string;
  bid_vol_2: number;
  bid_price_3: string;
  bid_vol_3: number;
  ask_price_1: string;
  ask_vol_1: number;
  ask_price_2: string;
  ask_vol_2: number;
  ask_price_3: string;
  ask_vol_3: number;
  foreign_buy_volume: number;
  foreign_sell_volume: number;
  foreign_room: number;
}

export interface ISymbolName {
  symbol: string;
  organ_name: string;
}

export enum ESymbolHistoryInterval {
  DAY = 'd',
  WEEK = 'w',
  MONTH = 'm',
}

export interface ISymbolHistoryFilter {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  length: number; // number of data points
  interval: ESymbolHistoryInterval;
  source?: string;
}

export interface ISymbolHistory {
  time: string; // YYYY-MM-DD HH:mm:ss
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
