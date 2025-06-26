import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form.username, form.password);
    } catch {
      setError("Неверный логин или пароль");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-6 w-80">
        <h1 className="text-xl font-semibold mb-4 text-center">Вход</h1>
        {error && <p className="text-red-600 mb-2 text-sm">{error}</p>}
        <Input
          placeholder="Логин"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="mb-2"
        />
        <Input
          type="password"
          placeholder="Пароль"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="mb-4"
        />
        <Button className="w-full" type="submit">
          Войти
        </Button>
      </form>
    </div>
  );
}