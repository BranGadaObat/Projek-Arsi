import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { loginSchema } from "shared";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { AlertIcon } from "../components/ui/Icons";

interface FormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { email: "", password: "" } });

  if (status === "authenticated") {
    return <Navigate to="/projects" replace />;
  }

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") setError(key, { message: issue.message });
      }
      return;
    }
    try {
      await login(parsed.data.email, parsed.data.password);
      navigate("/projects", { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Tidak bisa masuk. Coba lagi sebentar lagi.",
      );
    }
  }

  return (
    <AuthShell
      title="Masuk ke workspace"
      subtitle="Kelola jadwal, tim, dan jalur kritis proyek Anda."
      footer={
        <p className="text-[13px] text-ink-2">
          Belum punya akun?{" "}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            Daftar sekarang
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
        {formError ? (
          <div role="alert" className="flex items-start gap-2 rounded-sm border border-danger/25 bg-danger-bg px-3 py-2 text-[13px] text-danger">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            <span>{formError}</span>
          </div>
        ) : null}

        <Field label="Email" htmlFor="login-email" required error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="nama@perusahaan.com"
            error={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field label="Kata sandi" htmlFor="login-password" required error={errors.password?.message}>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            error={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Masuk
        </Button>

        <p className="rounded-sm border border-line bg-surface-2/60 px-3 py-2 text-[12px] text-ink-2">
          Akun demo: <span className="font-medium text-ink">demo@example.com</span> ·{" "}
          <span className="font-medium text-ink">Demo12345</span>
        </p>
      </form>
    </AuthShell>
  );
}
