import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  User,
  Settings as SettingsIcon,
  Shield,
  Users,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Lock,
  Gem,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Github,
  Star,
  AlertCircle,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usersAPI } from "@/services/apiService";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import CustomModal from "@/components/custom-modal";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { QuickSettingsModal } from "@/components/modals/QuickSettingsModal";
import { useLanguage } from "@/contexts/LanguageContext";

// Error boundary wrapper for Settings
class SettingsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Settings] Error boundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-background text-white"
          style={{
            background:
              "radial-gradient(circle, rgba(3, 98, 76, 1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundColor: "rgba(0, 15, 49, 0.05)",
          }}
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Settings crashed</h1>
            <p className="text-gray-300">
              {String(this.state.error?.message || "Unknown error")}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber?: string;
  avatarUrl?: string;
  displayName?: string;
}

interface SidebarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

const SettingsSidebar: React.FC<{
  activeSection: string;
  onSectionChange: (section: string) => void;
}> = ({ activeSection, onSectionChange }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useLanguage();

  const sections: SidebarItem[] = [
    {
      id: "account",
      label: t("settings.my_account"),
      icon: <User className="w-4 h-4" />,
    },
    { id: "connections", label: t("settings.connections") },
  ];

  const billingSections: SidebarItem[] = [
    { id: "subscriptions", label: t("subscriptions.title") },
  ];

  const appSections: SidebarItem[] = [];

  const filteredSections = (sections: SidebarItem[]) =>
    sections.filter((section) =>
      section.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const SidebarSection: React.FC<{
    title: string;
    items: SidebarItem[];
  }> = ({ title, items }) => (
    <div className="mb-6">
      <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </h3>
      <nav className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onSectionChange(item.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onSectionChange(item.id);
              }
            }}
            aria-current={activeSection === item.id ? "page" : undefined}
            className={`w-full flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
              activeSection === item.id
                ? "bg-[#03624C]/30 text-white border border-[#2CC295]/40"
                : "text-muted-foreground hover:bg-[#03624C]/20 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-3">
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <Badge
                className={`text-xs px-1.5 py-0.5 ${
                  item.badgeColor || "bg-red-500"
                }`}
              >
                {item.badge}
              </Badge>
            )}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="w-64 bg-card p-4 h-full overflow-y-auto border border-border rounded-2xl shadow-2xl">
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder={t("common.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/30 border-[#03624C]/40 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-[#2CC295] focus:border-[#2CC295] rounded-xl"
          />
        </div>
      </div>

      <SidebarSection
        title={t("settings.user_settings")}
        items={filteredSections(sections)}
      />
      <SidebarSection
        title={t("settings.billing_settings")}
        items={filteredSections(billingSections)}
      />
    </div>
  );
};

const SettingsContent: React.FC<{
  activeSection: string;
  userProfile: UserProfile | null;
  onUpdateProfile: (profile: UserProfile) => void;
}> = ({ activeSection, userProfile, onUpdateProfile }) => {
  const { t } = useLanguage();
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  // Social connections state
  type PlatformKey =
    | "linkedin"
    | "x"
    | "facebook"
    | "instagram"
    | "github"
    | "pinterest"
    | "reddit";
  const [socialConnections, setSocialConnections] = useState<
    Record<PlatformKey, boolean>
  >({
    linkedin: false,
    x: false,
    facebook: false,
    instagram: false,
    github: false,
    pinterest: false,
    reddit: false,
  });

  // Subscription state
  type PlanKey = "basic" | "pro" | "unlimited";
  const { plan } = useSubscription();
  const [messageUsage, setMessageUsage] = useState({ used: 0, limit: 0 });
  // Change Password modal state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpSuccess, setCpSuccess] = useState<string | null>(null);

  // Quick interactions state
  const [copied, setCopied] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const openChangePassword = () => {
    setIsChangePasswordOpen(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setCpError(null);
    setCpSuccess(null);
  };

  const submitChangePassword = async () => {
    setCpError(null);
    setCpSuccess(null);
    if (!currentPassword || !newPassword) {
      setCpError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setCpError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setCpError("New password must be at least 8 characters.");
      return;
    }
    try {
      setCpLoading(true);
      const resp = await fetch(
        `${
          import.meta.env.VITE_API_BASE_URL || "http://localhost:5044"
        }/api/users/password`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ currentPassword, newPassword }),
        }
      );
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(errorText || `Request failed: ${resp.status}`);
      }
      setCpSuccess("Password changed successfully.");
      setTimeout(() => setIsChangePasswordOpen(false), 1200);
    } catch (err: any) {
      setCpError(err?.message || "Failed to change password.");
    } finally {
      setCpLoading(false);
    }
  };
  const [stripeError, setStripeError] = useState<string | null>(null);

  const plans: Record<
    PlanKey,
    {
      name: string;
      price: number;
      limit: number;
      description: string;
      popular?: boolean;
    }
  > = {
    basic: {
      name: "Basic",
      price: 9,
      limit: 100,
      description: "For light usage",
    },
    pro: {
      name: "Pro",
      price: 19,
      limit: 200,
      description: "Great for regular use",
      popular: true,
    },
    unlimited: {
      name: "Unlimited",
      price: 29,
      limit: Infinity,
      description: "Best for heavy usage",
    },
  };

  useEffect(() => {
    setMessageUsage({ used: 0, limit: 0 });
  }, []);

  useEffect(() => {
    const fetchLinked = async () => {
      const token = localStorage.getItem("authToken") || "";
      const apiBase =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5044";
      try {
        const resp = await fetch(`${apiBase}/api/social/linked`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error("Failed to fetch linked accounts");
        const linked: { provider: string }[] = await resp.json();
        setSocialConnections({
          linkedin: linked.some((l) => l.provider === "linkedin"),
          x: linked.some((l) => l.provider === "x"),
          facebook: linked.some((l) => l.provider === "facebook"),
          instagram: linked.some((l) => l.provider === "instagram"),
          github: linked.some((l) => l.provider === "github"),
          pinterest: linked.some((l) => l.provider === "pinterest"),
          reddit: linked.some((l) => l.provider === "reddit"),
        });
      } catch (err) {
        console.error(err);
      }
    };
    fetchLinked();
  }, []);

  const toggleConnection = async (platform: PlatformKey) => {
    const token = localStorage.getItem("authToken") || "";
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:5044";

    try {
      if (!socialConnections[platform]) {
        // CONNECT social account
        // Step 1: Get authorization URL
        // New
        const redirectUri = `${window.location.origin}/settings/connections/callback/${platform}`;
        const authResp = await fetch(
          `${apiBase}/api/social/authorize/${platform}?redirectUri=${encodeURIComponent(
            redirectUri
          )}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!authResp.ok) throw new Error("Failed to get auth URL");
        const { url } = await authResp.json();

        // Step 2: Redirect user to provider login
        window.location.href = url;
        return;
      } else {
        // DISCONNECT social account
        const unlinkResp = await fetch(
          `${apiBase}/api/social/unlink/${platform}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!unlinkResp.ok) throw new Error("Failed to unlink social account");

        setSocialConnections((prev) => ({ ...prev, [platform]: false }));
      }
    } catch (err: any) {
      console.error("Social connection error", err);
      alert(err.message || "Something went wrong");
    }
  };

  const startCheckout = async (plan: PlanKey) => {
    try {
      const resp = await fetch(
        `${
          import.meta.env.VITE_API_BASE_URL || "http://localhost:5044"
        }/api/stripe/create-checkout-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
          credentials: "include",
        }
      );
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to create session: ${text}`);
      }
      const data = await resp.json();
      const url = data && data.url ? String(data.url) : "";
      if (url) {
        window.location.assign(url);
        return;
      }
      throw new Error("Checkout session created without a URL.");
    } catch (e: any) {
      setStripeError(e?.message || "Checkout error");
      console.error("Checkout error", e);
    }
  };

  const PlanCard: React.FC<{ planKey: PlanKey }> = ({ planKey }) => {
    const planInfo = plans[planKey];
    const isCurrent = plan === planKey;
    const used = messageUsage.used;
    const limit = planInfo.limit === Infinity ? used : planInfo.limit;
    const percent =
      planInfo.limit === Infinity
        ? 0
        : Math.min(100, Math.round((used / planInfo.limit) * 100));

    return (
      <Card className="p-6 bg-card rounded-2xl shadow-sm border border-border transition-all">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-foreground">
                {planInfo.name}
              </h3>
              {planInfo.popular && (
                <Badge className="bg-purple-600 text-white flex items-center gap-1">
                  <Star className="w-3 h-3" /> Popular
                </Badge>
              )}
            </div>
            <p className="text-gray-300 text-sm">{planInfo.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">
              ${planInfo.price}/mo
            </div>
            <div className="text-gray-400 text-xs">
              {planInfo.limit === Infinity
                ? "Unlimited messages"
                : `${planInfo.limit} messages/month`}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Usage</span>
            <span>
              {used}
              {planInfo.limit === Infinity ? "" : ` / ${planInfo.limit}`}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded mt-2">
            <div
              className={`h-2 rounded ${
                planInfo.limit === Infinity ? "bg-green-600 w-0" : "bg-blue-600"
              }`}
              style={{ width: `${percent}%` }}
            ></div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          {isCurrent ? (
            <Badge className="bg-green-600 text-white">Current Plan</Badge>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => startCheckout(planKey)}
            >
              Subscribe
            </Button>
          )}
          <div className="text-xs text-gray-400">
            <ul className="list-disc pl-5">
              <li>
                {planInfo.limit === Infinity
                  ? "Unlimited monthly messages"
                  : `${planInfo.limit} messages per month`}
              </li>
              <li>Priority support</li>
              <li>Access to new features</li>
            </ul>
          </div>
        </div>
      </Card>
    );
  };

  // Subscriptions Section
  const Subscriptions = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">
        {t("subscriptions.title")}
      </h2>
      <Card className="p-6 bg-card rounded-2xl shadow-2xl border border-border">
        <p className="text-gray-300 text-sm">
          Choose a plan that fits your message usage. Billing handled securely
          by Stripe.
        </p>
      </Card>
      <div className="grid md:grid-cols-3 gap-6">
        <PlanCard planKey="basic" />
        <PlanCard planKey="pro" />
        <PlanCard planKey="unlimited" />
      </div>
      {stripeError && (
        <Card className="bg-red-900/30 border-red-700 p-4 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#03624C]/50">
          <p className="text-red-200 text-sm">{stripeError}</p>
        </Card>
      )}
    </div>
  );

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    if (field === "fullName") {
      setEditFirstName(userProfile?.firstName || "");
      setEditLastName(userProfile?.lastName || "");
      return;
    }
    setEditValue(currentValue);
  };

  const handleSave = (field: string) => {
    if (userProfile) {
      if (field === "fullName") {
        const updatedProfile = {
          ...userProfile,
          firstName: editFirstName,
          lastName: editLastName,
        };
        onUpdateProfile(updatedProfile);
        setEditingField(null);
        return;
      }
      const updatedProfile = { ...userProfile, [field]: editValue };
      onUpdateProfile(updatedProfile);
    }
    setEditingField(null);
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue("");
    setEditFirstName("");
    setEditLastName("");
  };

  const maskEmail = (email: string) => {
    const [username, domain] = email.split("@");
    const maskedUsername =
      username.length > 4
        ? username.slice(0, 2) + "*".repeat(username.length - 2)
        : "*".repeat(username.length);
    return `${maskedUsername}@${domain}`;
  };

  const maskPhone = (phone: string) => {
    return phone.length > 4
      ? "*".repeat(phone.length - 4) + phone.slice(-4)
      : "*".repeat(phone.length);
  };

  const AccountSettings = () => (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-[#0b3b2f] to-[#064e3b] shadow-[0_0_20px_rgba(44,194,149,0.25)] ring-4 ring-[#2CC295]/30 transition-transform duration-300 hover:scale-[1.02]">
          <User className="w-10 h-10 text-white" />
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#03624C] border border-[#2CC295]/40 flex items-center justify-center text-xs text-white">
            ID
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] bg-clip-text text-transparent tracking-tight">
            {userProfile?.displayName || userProfile?.firstName || "ZeRoZz"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  role="button"
                  aria-label="Copy User ID"
                  className="text-xs bg-[#03624C]/60 border border-[#2CC295]/40 text-[#2CC295] hover:bg-[#03624C]/80 transition-colors"
                  onClick={async () => {
                    const id =
                      userProfile?.id ||
                      (typeof window !== "undefined"
                        ? window.localStorage.getItem("userId")
                        : "") ||
                      "";
                    try {
                      await navigator.clipboard.writeText(id);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    } catch {}
                  }}
                >
                  #
                </Badge>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-card/80 border border-[#03624C]/40"
              >
                {copied ? "Copied!" : "User ID"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  role="button"
                  aria-label="Open Quick Settings"
                  className="text-xs bg-[#03624C]/60 border border-[#2CC295]/40 text-[#2CC295] hover:bg-[#03624C]/80 transition-colors"
                  onClick={() => setQuickSettingsOpen(true)}
                >
                  <SettingsIcon className="w-3 h-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-card/80 border border-[#03624C]/40"
              >
                Quick Settings
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Information Card */}
      <Card className="p-6 bg-card rounded-2xl border border-border shadow-sm">
        <div className="space-y-6 divide-y divide-[#2CC295]/10">
          {/* Nickname Field */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm text-gray-400">
                {t("account.display_name")}
              </label>
              {editingField === "displayName" ? (
                <div className="flex space-x-2 mt-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="bg-card/30 border-[#03624C]/40 text-foreground focus:ring-2 focus:ring-[#2CC295] focus:border-[#2CC295]"
                  />
                  <Button size="sm" onClick={() => handleSave("displayName")}>
                    {t("common.save")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-lg bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] bg-clip-text text-transparent">
                    {userProfile?.displayName ||
                      userProfile?.firstName ||
                      "ZeRoZz"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#2CC295]/40 text-[#2CC295] hover:bg-[#03624C]/30 hover:border-[#2CC295]/70 transition-all duration-200 hover:translate-y-[0.5px] active:translate-y-[1px]"
                    onClick={() =>
                      handleEdit(
                        "displayName",
                        userProfile?.displayName || userProfile?.firstName || ""
                      )
                    }
                  >
                    {t("common.edit")}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Full Name Field */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm text-gray-400">
                {t("account.full_name")}
              </label>
              {editingField === "fullName" ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={editFirstName}
                    placeholder="First name"
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="bg-card/30 border-[#03624C]/40 text-foreground"
                  />
                  <Input
                    value={editLastName}
                    placeholder="Last name"
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="bg-card/30 border-[#03624C]/40 text-foreground"
                  />
                  <Button size="sm" onClick={() => handleSave("fullName")}>
                    {t("common.save")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-foreground text-lg">
                    {[userProfile?.firstName, userProfile?.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                      userProfile?.displayName ||
                      "—"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#2CC295]/40 text-[#2CC295] hover:bg-[#03624C]/30 hover:border-[#2CC295]/70 transition-all duration-200 hover:translate-y-[0.5px] active:translate-y-[1px]"
                    onClick={() => handleEdit("fullName", "")}
                  >
                    {t("common.edit")}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Email Field */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm text-gray-400">
                {t("account.email")}
              </label>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-lg bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] bg-clip-text text-transparent">
                  {showEmail
                    ? userProfile?.email
                    : maskEmail(userProfile?.email || "user@example.com")}
                </p>
                <button
                  onClick={() => setShowEmail(!showEmail)}
                  className="text-[#2CC295] hover:text-[#00DF81] text-sm"
                >
                  {showEmail ? t("common.hide") : t("common.show")}
                </button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 border-[#2CC295]/40 text-[#2CC295] hover:bg-[#03624C]/30 hover:border-[#2CC295]/70 transition-all duration-200 hover:translate-y-[0.5px] active:translate-y-[1px]"
                onClick={() => handleEdit("email", userProfile?.email || "")}
              >
                {t("common.edit")}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Password Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Password & Authentication
        </h3>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={openChangePassword}
        >
          <Lock className="w-4 h-4 mr-2" />
          Change Password
        </Button>
      </div>
    </div>
  );

  const SecurityCenter = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] bg-clip-text text-transparent">
        {t("settings.security_center")}
      </h2>
      <Card className="p-6 bg-card rounded-2xl shadow-2xl border border-border">
        <p className="text-gray-300">Security settings will appear here</p>
      </Card>
    </div>
  );

  // Connections Section
  const Connections = () => {
    const platforms: {
      key: PlatformKey;
      label: string;
      icon: React.ReactNode;
    }[] = [
      {
        key: "linkedin",
        label: "LinkedIn",
        icon: <Linkedin className="w-5 h-5 text-blue-500" />,
      },
      {
        key: "x",
        label: "X",
        icon: <Twitter className="w-5 h-5 text-blue-400" />,
      },
      {
        key: "facebook",
        label: "Facebook",
        icon: <Facebook className="w-5 h-5 text-blue-600" />,
      },
      {
        key: "instagram",
        label: "Instagram",
        icon: <Instagram className="w-5 h-5 text-pink-500" />,
      },
      {
        key: "github",
        label: "GitHub",
        icon: <Github className="w-5 h-5 text-gray-400" />,
      },
      {
        key: "pinterest",
        label: "Pinterest",
        icon: <Pin className="w-5 h-5 text-red-600" />,
      },
      {
        key: "reddit",
        label: "Reddit",
        icon: <span className="text-orange-600 font-bold text-lg">🔥</span>,
      },
    ];

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] bg-clip-text text-transparent">
          {t("settings.connections")}
        </h2>
        <Card className="p-6 bg-card rounded-2xl shadow-2xl border border-border">
          <div className="space-y-4">
            {platforms.map(({ key, label, icon }) => {
              const connected = socialConnections[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3">
                    {icon}
                    <span className="text-white text-sm font-medium">
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        connected
                          ? "bg-green-600 text-white"
                          : "bg-gray-700 text-gray-300"
                      }
                    >
                      {connected ? "Connected" : "Not Connected"}
                    </Badge>
                    <Button
                      size="sm"
                      variant={connected ? "outline" : "default"}
                      onClick={() => toggleConnection(key)}
                      className={
                        connected
                          ? "border-gray-500 text-gray-200"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }
                    >
                      {connected ? "Disconnect" : "Connect"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case "account":
        return <AccountSettings />;
      case "security":
        return <SecurityCenter />;
      case "connections":
        return <Connections />;
      case "subscriptions":
        return <Subscriptions />;
      default:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] bg-clip-text text-transparent">
              {t("settings.title")}
            </h2>
            <Card className="p-6 bg-card rounded-2xl shadow-2xl border border-border">
              <p className="text-gray-300">
                {t("settings.title")} for this section will appear here
              </p>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Top Tabs */}
      <div className="mb-8">
        <header className="w-full border-b border-border/50 bg-card/50 backdrop-blur-xl">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] bg-clip-text text-transparent">
              {t("settings.title")}
            </h1>
          </div>
        </header>
        <div className="flex space-x-8 border-b border-[#03624C]/50">
          <button className="pb-4 text-foreground font-medium border-b-2 border-[#2CC295]">
            {t("settings.security_center")}
          </button>
        </div>
      </div>

      {renderContent()}

      {/* Change Password Modal */}
      <CustomModal
        open={isChangePasswordOpen}
        title="Change Password"
        onClose={() => setIsChangePasswordOpen(false)}
      >
        {cpError && (
          <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{cpError}</span>
          </div>
        )}
        {cpSuccess && (
          <div className="mb-3 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 p-3">
            {cpSuccess}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitChangePassword();
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-sm text-gray-300">Current Password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="mt-1 bg-card/30 border-[#03624C]/40 text-foreground placeholder-muted-foreground"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-300">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="mt-1 bg-card/30 border-[#03624C]/40 text-foreground placeholder-muted-foreground"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-300">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="mt-1 bg-card/30 border-[#03624C]/40 text-foreground placeholder-muted-foreground"
              required
            />
          </div>

          <div className="flex gap-2 pt-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsChangePasswordOpen(false)}
              className="border-[#03624C]/40"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={cpLoading}
              className="bg-gradient-to-r from-[#2CC295] via-[#00DF81] to-[#03624C] text-white hover:opacity-90"
            >
              {cpLoading ? "Changing…" : "Change Password"}
            </Button>
          </div>
        </form>
      </CustomModal>
      <QuickSettingsModal
        open={quickSettingsOpen}
        onOpenChange={setQuickSettingsOpen}
      />
    </div>
  );
};

const Settings: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const initialSection = query.get("tab") || "account";

  const [activeSection, setActiveSection] = useState(initialSection);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { user, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    console.log(
      "[Settings] Mounted. user=",
      user,
      "loading=",
      loading,
      "isAuthenticated=",
      isAuthenticated
    );

    const fetchUserProfile = async () => {
      // prevent duplicate fetches that could hang
      if (hasFetchedRef.current) {
        console.log("[Settings] skipping duplicate profile fetch");
        return;
      }
      hasFetchedRef.current = true;

      const controller = new AbortController();
      const timeoutMs = 5000;
      const timeoutId = setTimeout(() => {
        console.warn(
          "[Settings] profile request timed out after",
          timeoutMs,
          "ms"
        );
        controller.abort();
        // still show UI with mock
        setUserProfile({
          id: "mock",
          firstName: "ZeRoZz",
          lastName: "",
          username: "ckai17",
          email: "user@gmail.com",
          phoneNumber: "1234567890",
          displayName: "ZeRoZz",
        });
      }, timeoutMs);

      try {
        const resp = await fetch(
          `${
            import.meta.env.VITE_API_BASE_URL || "http://localhost:5044"
          }/api/users/profile`,
          {
            headers: {
              Authorization: `Bearer ${
                localStorage.getItem("authToken") || ""
              }`,
              "Content-Type": "application/json",
            },
            credentials: "include",
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);
        if (!resp.ok) throw new Error(`Profile fetch failed: ${resp.status}`);
        const profile = await resp.json();
        setUserProfile(profile);
      } catch (error) {
        console.error("[Settings] Failed to fetch user profile:", error);
        // Use mock data for demo to avoid blank screen
        setUserProfile({
          id: "mock",
          firstName: "ZeRoZz",
          lastName: "",
          username: "ckai17",
          email: "user@gmail.com",
          phoneNumber: "1234567890",
          displayName: "ZeRoZz",
        });
      }
    };

    if (isAuthenticated && !loading) {
      fetchUserProfile();
    }
  }, [isAuthenticated, loading]);

  const handleUpdateProfile = (updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
    // Here you would typically call an API to update the profile
    console.log("Profile updated:", updatedProfile);
  };

  const handleClose = () => {
    navigate("/app");
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background text-foreground"
        style={{
          background:
            "radial-gradient(circle, rgba(3, 98, 76, 1) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          backgroundColor: "rgba(0, 15, 49, 0.05)",
        }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background text-foreground"
        style={{
          background:
            "radial-gradient(circle, rgba(3, 98, 76, 1) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          backgroundColor: "rgba(0, 15, 49, 0.05)",
        }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
          <p className="text-gray-300 mb-4">
            Please log in to access Settings.
          </p>
          <Button
            className="bg-primary text-white"
            onClick={() => navigate("/login")}
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SettingsErrorBoundary>
      <div
        className="min-h-screen bg-background text-foreground"
        style={{
          background:
            "radial-gradient(circle, rgba(3, 98, 76, 1) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          backgroundColor: "rgba(0, 15, 49, 0.05)",
        }}
      >
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl relative z-50">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.svg"
                alt="BrewPost"
                className="w-10 h-10 dark:filter dark:invert dark:brightness-0 dark:saturate-0"
              />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  BrewPost
                </h1>
                <p className="text-xs text-muted-foreground">
                  AI Content Generator
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                aria-label="ESC"
                onClick={() => navigate("/app")}
                className="text-muted-foreground hover:text-foreground"
              >
                ESC
              </Button>
            </div>
          </div>
        </header>
        <div className="flex h-screen">
          {/* Sidebar */}
          <SettingsSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Close Button */}
            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-card/60 border border-[#03624C]/40 flex items-center justify-center text-sm">
                    ×
                  </span>
                  <span className="text-sm">ESC</span>
                </div>
              </Button>
            </div>

            <SettingsContent
              activeSection={activeSection}
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
            />
          </div>
        </div>
      </div>
    </SettingsErrorBoundary>
  );
};

export default Settings;
