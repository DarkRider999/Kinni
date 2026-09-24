import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AppProvider, useApp } from "./lib/app-state";
import { initTheme } from "./lib/theme";
import { BatchNew } from "./pages/BatchNew";
import { BatchDetail, Batches } from "./pages/Batches";
import { Editor } from "./pages/Editor";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { Upload } from "./pages/Upload";
import "./styles/app.css";

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useApp();
  if (loading) return null;
  return me ? <>{children}</> : <Navigate to="/login" replace />;
}

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Shell />
              </RequireAuth>
            }
          >
            <Route index element={<Home />} />
            <Route path="upload" element={<Upload />} />
            <Route path="editor/:fileId" element={<Editor />} />
            <Route path="batches" element={<Batches />} />
            <Route path="batches/new" element={<BatchNew />} />
            <Route path="batches/:batchId" element={<BatchDetail />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  </StrictMode>,
);
