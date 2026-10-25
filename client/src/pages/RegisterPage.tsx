import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { registerSchema } from "shared";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { AlertIcon } from "../components/ui/Icons";

interface FormValues {
  name: string;
  email: string;
  password: string;
}

export function RegisterPage() {
  const { register: registerUser, status } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { name: "", email: "", password: "" } });

  if (status === "authenticated") {
    return <Navigate to="/projects" replace />;
  }

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "name" || key === "email" || key === "password") {
          setError(key, { message: issue.message });
        }
      }
      return;
    }
    try {
      await registerUser(parsed.data.name, parsed.data.email, parsed.data.password);
      navigate("/projects", { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Pendaftaran gagal. Coba lagi sebentar lagi.",
      );
    }
  }

  return (
    <AuthShell
      title="Buat akun"
      subtitle="Mulai kelola proyek pertama Anda dalam beberapa menit."
      footer={
        <p className="text-[13px] text-ink-2">
          Sudah punya akun?{" "}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Masuk
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

        <Field label="Nama lengkap" htmlFor="register-name" required error={errors.name?.message}>
          <Input
            id="register-name"
            autoComplete="name"
            placeholder="Contoh: Siti Rahma"
            error={Boolean(errors.name)}
            {...register("name")}
          />
        </Field>

        <Field label="Email" htmlFor="register-email" required error={errors.email?.message}>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="nama@perusahaan.com"
            error={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field
          label="Kata sandi"
          htmlFor="register-password"
          required
          hint="Minimal 8 karakter."
          error={errors.password?.message}
        >
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="Buat kata sandi"
            error={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Daftar dan mulai
        </Button>
      </form>
    </AuthShell>
  );
}
