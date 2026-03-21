import React, { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";

const Index = lazy(() => import("./pages/Index.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const SelectTeamMember = lazy(() => import("./pages/SelectTeamMember.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Chat = lazy(() => import("./pages/Chat.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Install = lazy(() => import("./pages/Install.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, teamMemberId, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!teamMemberId) return <Navigate to="/select-member" replace />;

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/select-member" element={<SelectTeamMember />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <AppProvider>
                      <Chat />
                    </AppProvider>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <AppProvider>
                      <Settings />
                    </AppProvider>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppProvider>
                      <Index />
                    </AppProvider>
                  </ProtectedRoute>
                }
              />
              <Route path="/install" element={<Install />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
