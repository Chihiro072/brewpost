import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LanguageCode } from '@/utils/translations';

export interface QuickSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QuickSettingsModal: React.FC<QuickSettingsModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] =
    useState<boolean>(true);

  useEffect(() => {
    try {
      const storedTheme =
        (typeof window !== 'undefined' &&
          window.localStorage.getItem('bp_theme')) ||
        'dark';
      const storedNotif =
        (typeof window !== 'undefined' &&
          window.localStorage.getItem('bp_notifications')) ||
        'on';

      const isWhiteTheme = storedTheme === 'white';
      setDarkMode(isWhiteTheme);
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('white-theme', isWhiteTheme);
        document.documentElement.classList.remove('dark');
      }

      setNotificationsEnabled(storedNotif !== 'off');
    } catch {
      // ignore
    }
  }, []);

  const handleThemeToggle = (checked: boolean) => {
    setDarkMode(checked);
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('white-theme', checked);
        if (!checked) {
          document.documentElement.classList.remove('white-theme');
        }
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('bp_theme', checked ? 'white' : 'dark');
      }
      toast({
        title: `${
          checked ? t('settings.light_mode') : t('settings.dark_mode')
        }: ${checked ? 'On' : 'Off'}`,
        variant: 'success',
      });
    } catch {}
  };

  const handleNotificationsToggle = (checked: boolean) => {
    setNotificationsEnabled(checked);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('bp_notifications', checked ? 'on' : 'off');
      }
      toast({
        title: checked
          ? t('settings.notifications') + ' On'
          : t('settings.notifications') + ' Off',
        variant: 'success',
      });
    } catch {}
  };

  const handleLanguageChange = (value: LanguageCode) => {
    onOpenChange(false);
    setTimeout(() => {
      setLanguage(value);
      toast({
        title: `${t('settings.language')}: ${value.toUpperCase()}`,
        variant: 'success',
      });
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          darkMode
            ? 'max-w-md bg-white text-black border border-gray-200 shadow-xl rounded-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'
            : 'max-w-md bg-[rgba(3,34,33,0.92)] backdrop-blur-xl border border-[#03624C]/50 shadow-[0_0_30px_rgba(44,194,149,0.25)] rounded-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'
        }
      >
        <DialogHeader>
          <DialogTitle
            className={
              darkMode
                ? 'text-lg font-semibold text-gray-900'
                : 'text-lg font-semibold bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] bg-clip-text text-transparent'
            }
          >
            {t('settings.quick_settings')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label
                className={
                  darkMode
                    ? 'text-sm text-gray-900'
                    : 'text-sm text-muted-foreground'
                }
              >
                {darkMode ? t('settings.light_mode') : t('settings.dark_mode')}
              </Label>
              <p
                className={
                  darkMode
                    ? 'text-xs text-gray-700'
                    : 'text-xs text-muted-foreground/80'
                }
              >
                {darkMode
                  ? t('settings.light_mode_desc')
                  : t('settings.dark_mode_desc')}
              </p>
            </div>
            <Switch
              checked={darkMode}
              onCheckedChange={handleThemeToggle}
              aria-label="Toggle theme"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label
                className={
                  darkMode
                    ? 'text-sm text-gray-900'
                    : 'text-sm text-muted-foreground'
                }
              >
                {t('settings.notifications')}
              </Label>
              <p
                className={
                  darkMode
                    ? 'text-xs text-gray-700'
                    : 'text-xs text-muted-foreground/80'
                }
              >
                {t('settings.notifications_desc')}
              </p>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationsToggle}
              aria-label="Toggle notifications"
            />
          </div>

          <div className="grid gap-2">
            <Label
              className={
                darkMode
                  ? 'text-sm text-gray-900'
                  : 'text-sm text-muted-foreground'
              }
            >
              {t('settings.language')}
            </Label>
            <Select
              value={language}
              onValueChange={(v) => handleLanguageChange(v as LanguageCode)}
            >
              <SelectTrigger
                className={
                  darkMode
                    ? 'w-full bg-white border border-gray-300 text-gray-900'
                    : 'w-full bg-card/60 border border-[#03624C]/40'
                }
              >
                <SelectValue placeholder={t('settings.select_language')} />
              </SelectTrigger>
              <SelectContent
                className={
                  darkMode
                    ? 'bg-white border border-gray-300 text-gray-900'
                    : 'bg-[rgba(3,34,33,0.95)] border border-[#03624C]/40'
                }
              >
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ms">Malay</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="secondary"
              className="bg-[#03624C]/30 border border-[#2CC295]/40"
              onClick={() => onOpenChange(false)}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
