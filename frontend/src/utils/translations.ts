export type LanguageCode = "en" | "ms" | "zh";

export type TranslationDict = Record<string, string | TranslationDict>;

export const dictionaries: Record<LanguageCode, TranslationDict> = {
  en: {
    common: {
      close: "Close",
      save: "Save",
      cancel: "Cancel",
      search: "Search",
      edit: "Edit",
      show: "Show",
      hide: "Hide",
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
      user_settings: "User Settings",
      connections: "Connections",
      billing_settings: "Billing Settings",
      my_account: "My Account",
      security_center: "Security Center",
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
    account: {
      display_name: "Display Name",
      full_name: "Full Name",
      email: "Email",
    },
  },
  ms: {
    common: {
      close: "Tutup",
      save: "Simpan",
      cancel: "Batal",
      search: "Cari",
      edit: "Edit",
      show: "Tunjuk",
      hide: "Sembunyi",
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
      user_settings: "Tetapan Pengguna",
      connections: "Sambungan",
      billing_settings: "Tetapan Bil",
      my_account: "Akaun Saya",
      security_center: "Pusat Keselamatan",
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
    account: {
      display_name: "Nama Paparan",
      full_name: "Nama Penuh",
      email: "Emel",
    },
  },
  zh: {
    common: {
      close: "关闭",
      save: "保存",
      cancel: "取消",
      search: "搜索",
      edit: "编辑",
      show: "显示",
      hide: "隐藏",
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
      user_settings: "用户设置",
      connections: "连接",
      billing_settings: "账单设置",
      my_account: "我的账户",
      security_center: "安全中心",
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
    account: {
      display_name: "显示名称",
      full_name: "全名",
      email: "电子邮件",
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