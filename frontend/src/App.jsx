// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import LoginPage from "@/auth/LoginPage";
import BudgetTableDemo from "@/components/BudgetTableDemo";

/* ----- защищённый маршрут ----- */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <BudgetTableDemo />
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}