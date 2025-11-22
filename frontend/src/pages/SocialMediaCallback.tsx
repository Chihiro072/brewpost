import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { AlertCircle } from "lucide-react";

const SocialCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { provider } = useParams<{ provider: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const code = query.get("code");
    const state = query.get("state"); // optional if you use CSRF/state

    if (!provider || !code) {
      setStatus("error");
      setMessage("Missing provider or code in callback URL.");
      return;
    }

    const redirectUri = `${window.location.origin}/settings/connections/callback/`;

    const linkAccount = async () => {
      try {
        const resp = await fetch(
          `${
            import.meta.env.VITE_API_BASE_URL || "http://localhost:5044"
          }/api/social/connect/${provider}?code=${code}&redirectUri=${encodeURIComponent(
            redirectUri
          )}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${
                localStorage.getItem("authToken") || ""
              }`,
            },
            credentials: "include",
          }
        );

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || `Request failed with status ${resp.status}`);
        }

        const data = await resp.json();
        setStatus("success");
        setMessage(data.message || `Connected to ${provider} successfully.`);

        // Redirect back to Settings page (connections tab) after short delay
        setTimeout(() => navigate("/settings?tab=connections"), 1500);
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message || "Failed to link social account.");
      }
    };

    linkAccount();
  }, [location.search, provider, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-white">
      <Card className="p-6 bg-[rgba(3,34,33,0.95)] backdrop-blur-xl rounded-2xl shadow-2xl border border-[#03624C]/50">
        {status === "loading" && <p>Connecting {provider} account…</p>}
        {status === "success" && <p className="text-green-400">{message}</p>}
        {status === "error" && (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{message}</span>
          </div>
        )}
        {status !== "loading" && (
          <div className="mt-4">
            <Button onClick={() => navigate("/settings?tab=connections")}>
              Back to Connections
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SocialCallback;
