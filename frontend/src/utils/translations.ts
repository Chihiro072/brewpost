export type LanguageCode = "en" | "ms" | "zh";

export type TranslationDict = Record<string, string | TranslationDict>;

export const dictionaries: Record<LanguageCode, TranslationDict> = {
  en: {
    common: {
      close: "Close",
      save: "Save",
      cancel: "Cancel",
      search: "Search",
    },
    settings: {
      title: "Settings",
      quick_settings: "Quick Settings",
      dark_mode: "Dark Mode",
      dark_mode_desc: "Toggle application theme",
      notifications: "Notifications",
      notifications_desc: "Enable message and system alerts",
      language: "Language",
      select_language: "Select language",
    },
    subscriptions: {
      title: "Subscriptions",
      basic: "Basic",
      pro: "Pro",
      unlimited: "Unlimited",
      subscribe: "Subscribe",
    },
    user: {
      id: "User ID",
      copied: "Copied!",
      you: "You",
      ai: "AI",
      system: "System",
    },
  },
  ms: {
    common: {
      close: "Tutup",
      save: "Simpan",
      cancel: "Batal",
      search: "Cari",
    },
    settings: {
      title: "Tetapan",
      quick_settings: "Tetapan Pantas",
      dark_mode: "Mod Gelap",
      dark_mode_desc: "Tukar tema aplikasi",
      notifications: "Notifikasi",
      notifications_desc: "Aktifkan amaran mesej dan sistem",
      language: "Bahasa",
      select_language: "Pilih bahasa",
    },
    subscriptions: {
      title: "Langganan",
      basic: "Asas",
      pro: "Pro",
      unlimited: "Tanpa Had",
      subscribe: "Langgan",
    },
    user: {
      id: "ID Pengguna",
      copied: "Disalin!",
      you: "Anda",
      ai: "AI",
      system: "Sistem",
    },
  },
  zh: {
    common: {
      close: "关闭",
      save: "保存",
      cancel: "取消",
      search: "搜索",
    },
    settings: {
      title: "设置",
      quick_settings: "快速设置",
      dark_mode: "深色模式",
      dark_mode_desc: "切换应用主题",
      notifications: "通知",
      notifications_desc: "启用消息和系统提醒",
      language: "语言",
      select_language: "选择语言",
    },
    subscriptions: {
      title: "订阅",
      basic: "基础版",
      pro: "专业版",
      unlimited: "无限版",
      subscribe: "订阅",
    },
    user: {
      id: "用户ID",
      copied: "已复制！",
      you: "你",
      ai: "AI",
      system: "系统",
    },
  },
};

function get(obj: TranslationDict, path: string[]): string | TranslationDict | undefined {
  let cur: any = obj;
  for (const key of path) {
    cur = cur?.[key];
    if (cur == null) return undefined;
  }
  return cur;
}

export function translate(lang: LanguageCode, key: string, params?: Record<string, string | number>): string {
  const path = key.split(".");
  const fromDict = get(dictionaries[lang], path);
  let str = typeof fromDict === "string" ? fromDict : undefined;
  if (!str) {
    const fallback = get(dictionaries.en, path);
    str = typeof fallback === "string" ? fallback : key;
  }
  if (params && typeof str === "string") {
    Object.entries(params).forEach(([k, v]) => {
      str = str!.replace(new RegExp(`{${k}}`, "g"), String(v));
    });
  }
  return str!;
}