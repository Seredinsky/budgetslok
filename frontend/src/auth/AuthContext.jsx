import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/api/axios";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [loading, setLoading] = useState(true);

  // проверяем сессию при монтировании
  useEffect(() => {
    api.get("users/me/")
      .then(({ data }) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    await api.post("login/", { username, password });
    const { data } = await api.get("users/me/");
    setUser(data);
  };

  const logout = async () => {
    await api.post("logout/");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}