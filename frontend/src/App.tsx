import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Callback from "./pages/Callback";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import { CalendarPage } from "./pages/CalendarPage";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import TestTwitterPage from "./pages/TestTwitterPage";
import XCallbackPage from "./pages/XCallbackPage";
import TestLinkedInPage from "./pages/TestLinkedInPage";
import PaymentSuccess from "./pages/PaymentSuccess";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import SocialCallback from "./pages/SocialMediaCallback";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <LanguageProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                {/* Protect app routes that require authentication */}
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <CalendarPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/Callback" element={<Callback />} />
                <Route path="/test-twitter" element={<TestTwitterPage />} />
                <Route path="/x-callback" element={<XCallbackPage />} />
                <Route path="/test-linkedin" element={<TestLinkedInPage />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route
                  path="/settings/connections/callback/:provider"
                  element={<SocialCallback />}
                />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </LanguageProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
