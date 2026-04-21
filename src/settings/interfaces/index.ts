export interface ISettings {
  threshold: IThresholdSettings;
  discord: IDiscordSettings;
}

export interface IThresholdSettings {
    alertThresholdPercent: number;
    stopLossPercent: number;
    takeProfitPercent: number;
}

export interface IDiscordSettings {
    alertChannelId: string;
}