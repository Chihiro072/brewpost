import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translate, dictionaries, type LanguageCode } from "@/utils/translations";

export type LanguageContextType = {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const stored = (typeof window !== "undefined" && window.localStorage.getItem("bp_language")) as LanguageCode | null;
    return stored || "en";
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("bp_language", language);
        document.documentElement.setAttribute("lang", language);
        document.documentElement.setAttribute("translate", "no");
      }
    } catch {}
  }, [language]);

  const setLanguage = (lang: LanguageCode) => {
    if (!dictionaries[lang]) lang = "en";
    setLanguageState(lang);
  };

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
