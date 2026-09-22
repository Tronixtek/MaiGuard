import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "./index.css";
import { DataProvider } from "./lib/data";
import { AuthProvider } from "./lib/auth";
import { MemberProvider } from "./lib/member";
import { Account } from "./pages/Account";
import { RequireTrustedVoice } from "./pages/SignIn";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { TrustedVoice } from "./pages/TrustedVoice";
import { CheckRumour } from "./pages/CheckRumour";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
    <MemberProvider>
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="voice" element={<RequireTrustedVoice><TrustedVoice /></RequireTrustedVoice>} />
            <Route path="check" element={<CheckRumour />} />
            <Route path="account" element={<Account />} />
            <Route path="town" element={<Navigate to="/voice" replace />} />
            <Route path="*" element={<Landing />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
    </MemberProvider>
    </AuthProvider>
  </StrictMode>,
);
