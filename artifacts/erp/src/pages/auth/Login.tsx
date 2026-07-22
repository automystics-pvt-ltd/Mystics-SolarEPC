import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { HardHat, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({
          title: "Login Failed",
          description: error.message || "Invalid credentials. Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values });
  }

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #f5f6fa 0%, #eef2ff 100%)" }}>
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex w-[420px] flex-col justify-between p-10 shrink-0 text-white"
        style={{ background: "linear-gradient(160deg, #4f46e5 0%, #7c3aed 100%)" }}
      >
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <HardHat className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">Mystics ERP</div>
              <div className="text-white/60 text-xs">Powered by Automystics</div>
            </div>
          </div>

          <h2 className="text-3xl font-bold leading-snug mb-4">
            Engineering &<br />Project Control
          </h2>
          <p className="text-white/70 text-[14px] leading-relaxed">
            A full-stack EPC ERP for Automystics Technologies — managing sales pipelines, project execution, procurement, and warehouse operations in one place.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { icon: "🎯", label: "Sales & CRM" },
            { icon: "🏗️", label: "Project Management" },
            { icon: "📦", label: "Inventory & Warehouse" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-3">
              <span className="text-lg">{m.icon}</span>
              <span className="text-[13px] font-medium">{m.label}</span>
            </div>
          ))}
        </div>

        <div className="text-white/40 text-[11px]">
          © 2026 Automystics Technologies Pvt. Ltd.
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 justify-center mb-8 lg:hidden">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <HardHat className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">Mystics ERP</span>
          </div>

          <div className="mb-7">
            <h1 className="text-[22px] font-bold text-gray-900">Sign in to your account</h1>
            <p className="text-[13px] text-gray-500 mt-1">Enter your credentials to access the ERP</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium text-gray-700">Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="name@automystics.com"
                          {...field}
                          className="h-10 bg-gray-50 border-gray-200 text-[13px] focus-visible:ring-indigo-400"
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium text-gray-700">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          className="h-10 bg-gray-50 border-gray-200 text-[13px] focus-visible:ring-indigo-400"
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-10 text-[14px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in…</>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
          </div>

          <div className="mt-6 space-y-1">
            <p className="text-[11px] text-gray-400 text-center">Demo accounts:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Admin", email: "admin@automystics.com", pw: "admin123" },
                { label: "Sales", email: "rajan@automystics.com", pw: "sales123" },
                { label: "PM", email: "priya@automystics.com", pw: "pm123" },
                { label: "Warehouse", email: "kiran@automystics.com", pw: "wh123" },
              ].map((acc) => (
                <button
                  key={acc.label}
                  type="button"
                  onClick={() => {
                    form.setValue("email", acc.email);
                    form.setValue("password", acc.pw);
                  }}
                  className="text-[11px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg py-1.5 px-2 font-medium transition-colors text-left"
                >
                  {acc.label}: {acc.pw}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
