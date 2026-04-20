import { ISettings } from "../interfaces";

export const DEFAULT_SETTING: ISettings = {
    threshold: {
        alertThresholdPercent: 5,
        stopLossPercent: 3,
        takeProfitPercent: 10,
    }
};