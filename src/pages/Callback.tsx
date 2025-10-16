// pages/Callback.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Callback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Finishing login…");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    // Check if this is a LinkedIn callback by looking for specific parameters
    const isLinkedInCallback = params.has("state") && code && !params.has("scope"); // LinkedIn doesn't send scope in callback

    if (error) {
      setStatus(`Authorization failed: ${error}`);
      setTimeout(() => navigate("/"), 3000);
      return;
    }

    if (!code) {
      setStatus("No code found. Redirecting to home...");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    const exchangeToken = async () => {
      try {
        if (isLinkedInCallback) {
          // Handle LinkedIn callback
          setStatus("Processing LinkedIn authorization...");
          const res = await fetch(`/api/linkedin-callback?code=${code}&state=${state}`);
          const data = await res.json();

          if (data.success) {
            setStatus("LinkedIn authorization successful! Redirecting to test page...");
            setTimeout(() => navigate("/test-linkedin"), 2000);
          } else {
            setStatus(`LinkedIn authorization failed: ${data.error}`);
            setTimeout(() => navigate("/test-linkedin"), 3000);
          }
        } else {
          // Handle Cognito callback (existing logic)
          const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ?? 'https://54.242.36.109';
          const res = await fetch(`${BACKEND_URL}/api/auth/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
            credentials: "include",
          });

          if (res.ok) {
            // server now returns { success: true, tokens }
            const body = await res.json().catch(() => null);
            const tokens = body?.tokens ?? null;

            // NEW: if id_token present decode it and store userId in localStorage for per-user fetches
            try {
              if (tokens && tokens.id_token) {
                const parts = String(tokens.id_token).split('.');
                if (parts.length >= 2) {
                  // base64url -> base64
                  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                  const json = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                  const payload = JSON.parse(json);
                  if (payload && payload.sub) {
                    localStorage.setItem('userId', payload.sub);
                  }
                }
              }
              // Also persist tokens client-side for convenience (optional)
              if (tokens) localStorage.setItem('auth_tokens', JSON.stringify(tokens));
            } catch (e) {
              console.warn('Failed to decode id_token or store userId:', e);
            }

            setStatus("Login successful! Redirecting...");
            navigate("/app");
          } else {
            setStatus("Login failed. Please try again.");
          }
        }
      } catch (err) {
        console.error(err);
        setStatus("Error during login.");
      }
    };

    exchangeToken();
  }, [location, navigate]);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>{status}</h1>
    </div>
  );
}
