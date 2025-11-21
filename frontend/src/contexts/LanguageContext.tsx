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
      }
    } catch {}
  }, [language]);

  const setLanguage = (lang: LanguageCode) => {
    if (!dictionaries[lang]) lang = "en";
    setLanguageState(lang);

    try {
      const map: Record<LanguageCode, string> = { en: "en", ms: "ms", zh: "zh-CN" };
      const target = map[lang] || "en";
      const cookieVal = `/en/${target}`;
      // Write googtrans cookie for both host and root to ensure translator picks it
      document.cookie = `googtrans=${cookieVal};path=/;`; 
      document.cookie = `googtrans=${cookieVal};domain=${location.hostname};path=/;`;

      // Ensure translate element is initialized once
      if (!(window as any).googleTranslateElementInit) {
        (window as any).googleTranslateElementInit = () => {
          try {
            new (window as any).google.translate.TranslateElement({ pageLanguage: "en" }, "google_translate_element");
          } catch {}
        };
      }
      if (!(document.getElementById("google_translate_element"))) {
        const el = document.createElement("div");
        el.id = "google_translate_element";
        el.style.display = "none"; // keep hidden
        document.body.appendChild(el);
      }
      if (!(document.getElementById("google_translate_script"))) {
        const s = document.createElement("script");
        s.id = "google_translate_script";
        s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        document.body.appendChild(s);
      } else {
        // If script already loaded, trigger re-translate by calling init
        const init = (window as any).googleTranslateElementInit;
        if (typeof init === "function") init();
      }
    } catch {}
  };

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};