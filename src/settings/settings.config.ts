export interface SettingDefinition<T = unknown> {
  defaultValue: T;
  description: string;
}

export const SETTINGS_CONFIG = {
  'stock.apiBaseUrl': {
    defaultValue: 'http://localhost:8000',
    description: 'URL của stock-alert FastAPI service',
  },
  'stock.apiSource': {
    defaultValue: 'KBS',
    description: 'Nguồn dữ liệu mặc định (KBS, VCI, ...)',
  },
  'stock.alertThresholdPercent': {
    defaultValue: 3,
    description: 'Ngưỡng % biến động giá để gửi cảnh báo',
  },
  'stock.stopLossPercent': {
    defaultValue: 7,
    description: 'Ngưỡng % lỗ so với giá mua để kích hoạt cảnh báo dừng lỗ',
  },
  'stock.takeProfitPercent': {
    defaultValue: 15,
    description: 'Ngưỡng % lời so với giá mua để kích hoạt cảnh báo chốt lời',
  },
  'discord.alertChannelId': {
    defaultValue: '',
    description: 'Channel ID Discord nhận cảnh báo giá',
  },
} as const satisfies Record<string, SettingDefinition>;

export type SettingKey = keyof typeof SETTINGS_CONFIG;

export type SettingsMap = {
  [K in SettingKey]: (typeof SETTINGS_CONFIG)[K]['defaultValue'];
};

export const SETTING_KEYS = Object.keys(SETTINGS_CONFIG) as SettingKey[];
