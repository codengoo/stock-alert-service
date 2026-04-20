export interface ISettings {
  threshold: IThresholdSettings;
}

export interface IThresholdSettings {
    alertThresholdPercent: number;
    stopLossPercent: number;
    takeProfitPercent: number;
}