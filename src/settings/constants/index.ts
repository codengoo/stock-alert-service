import { ISettings } from "../interfaces";

export const DEFAULT_SETTING: ISettings = {
    threshold: {
        alertThresholdPercent: 5,
        stopLossPercent: 3,
        takeProfitPercent: 10,
    },
    discord: {
        alertChannelId: '1496041524411236432',
        goldChannelId: '1501069220128096266',
    },
};