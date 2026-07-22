import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
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
      onSuccess: (data) => { login(data.token, data.user); setLocation("/dashboard"); },
      onError: (error) => {
        toast({ title: "Login Failed", description: error.message || "Invalid credentials.", variant: "destructive" });
      },
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values });
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Solar landscape ── */}
      <div className="hidden lg:flex w-[420px] shrink-0 relative overflow-hidden flex-col">
        {/* Sky gradient */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(175deg, #05091f 0%, #0c1a6e 38%, #b45309 72%, #7c2d12 100%)"
        }} />

        {/* Stars */}
        {[
          [60,45],[120,80],[200,30],[280,60],[350,40],[80,120],[310,100],
          [160,150],[240,95],[50,170],[330,145],[180,200],[100,220]
        ].map(([x,y], i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{ left: x, top: y, width: i % 3 === 0 ? 2 : 1.5, height: i % 3 === 0 ? 2 : 1.5, opacity: 0.6 + (i % 4) * 0.1 }} />
        ))}

        {/* Solar scene SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 420 700" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.55"/>
              <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.15"/>
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="sunCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde68a"/>
              <stop offset="50%" stopColor="#fbbf24"/>
              <stop offset="100%" stopColor="#f59e0b"/>
            </radialGradient>
            <linearGradient id="horizonFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="transparent"/>
              <stop offset="100%" stopColor="#050914" stopOpacity="0.9"/>
            </linearGradient>
          </defs>

          {/* Sun glow */}
          <circle cx="210" cy="310" r="130" fill="url(#sunGlow)"/>
          {/* Sun core */}
          <circle cx="210" cy="310" r="44" fill="url(#sunCore)"/>
          <circle cx="210" cy="310" r="36" fill="#fde68a" opacity="0.7"/>

          {/* Sun rays */}
          {[0,45,90,135,180,225,270,315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 210 + 52 * Math.cos(rad), y1 = 310 + 52 * Math.sin(rad);
            const x2 = 210 + 76 * Math.cos(rad), y2 = 310 + 76 * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth={i % 2 === 0 ? 3 : 2} strokeLinecap="round" opacity="0.8"/>;
          })}

          {/* Horizon overlay */}
          <rect x="0" y="510" width="420" height="190" fill="url(#horizonFade)"/>
          <rect x="0" y="570" width="420" height="130" fill="#050914"/>

          {/* Wind turbine 1 (left) */}
          <line x1="90" y1="575" x2="90" y2="460" stroke="#1e293b" strokeWidth="3.5"/>
          <line x1="90" y1="460" x2="90" y2="420" stroke="#1e293b" strokeWidth="2.5"/>
          <line x1="90" y1="460" x2="57" y2="488" stroke="#1e293b" strokeWidth="2.5"/>
          <line x1="90" y1="460" x2="123" y2="488" stroke="#1e293b" strokeWidth="2.5"/>
          <circle cx="90" cy="460" r="4" fill="#334155"/>

          {/* Wind turbine 2 (right, smaller/farther) */}
          <line x1="345" y1="575" x2="345" y2="482" stroke="#1e293b" strokeWidth="2.5"/>
          <line x1="345" y1="482" x2="345" y2="450" stroke="#1e293b" strokeWidth="2"/>
          <line x1="345" y1="482" x2="317" y2="505" stroke="#1e293b" strokeWidth="2"/>
          <line x1="345" y1="482" x2="373" y2="505" stroke="#1e293b" strokeWidth="2"/>
          <circle cx="345" cy="482" r="3" fill="#334155"/>

          {/* Solar panels — row back (small) */}
          {[0,1,2,3,4,5,6,7].map(i => (
            <g key={`b${i}`} transform={`translate(${14 + i * 50}, 575)`}>
              <rect width="44" height="14" rx="1" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="0.4"/>
              <line x1="15" y1="0" x2="15" y2="14" stroke="#3b82f6" strokeWidth="0.35"/>
              <line x1="29" y1="0" x2="29" y2="14" stroke="#3b82f6" strokeWidth="0.35"/>
              <line x1="0" y1="7" x2="44" y2="7" stroke="#3b82f6" strokeWidth="0.35"/>
            </g>
          ))}

          {/* Solar panels — row mid */}
          {[0,1,2,3,4,5].map(i => (
            <g key={`m${i}`} transform={`translate(${8 + i * 68}, 593)`}>
              <rect width="60" height="20" rx="1" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="0.5"/>
              <line x1="20" y1="0" x2="20" y2="20" stroke="#60a5fa" strokeWidth="0.4"/>
              <line x1="40" y1="0" x2="40" y2="20" stroke="#60a5fa" strokeWidth="0.4"/>
              <line x1="0" y1="10" x2="60" y2="10" stroke="#60a5fa" strokeWidth="0.4"/>
            </g>
          ))}

          {/* Solar panels — row front (large) */}
          {[0,1,2,3].map(i => (
            <g key={`f${i}`} transform={`translate(${5 + i * 103}, 618)`}>
              <rect width="92" height="32" rx="2" fill="#1e40af" stroke="#93c5fd" strokeWidth="0.6"/>
              <line x1="31" y1="0" x2="31" y2="32" stroke="#93c5fd" strokeWidth="0.5"/>
              <line x1="61" y1="0" x2="61" y2="32" stroke="#93c5fd" strokeWidth="0.5"/>
              <line x1="0" y1="16" x2="92" y2="16" stroke="#93c5fd" strokeWidth="0.5"/>
            </g>
          ))}
        </svg>

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col h-full p-10 text-white">
          <div className="flex items-center gap-3 mb-auto">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)", boxShadow: "0 0 16px rgba(245,158,11,0.5)" }}>
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">Mystics ERP</div>
              <div className="text-[11px] opacity-60">Powered by Automystics</div>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold leading-snug mb-3">
              Solar EPC<br />Management
            </h2>
            <p className="text-white/65 text-[13px] leading-relaxed">
              Complete control for solar EPC projects — from client acquisition to commissioning and inventory.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { icon: "☀️", label: "Sales & CRM Pipeline" },
              { icon: "🏗️", label: "Project Execution & DPR" },
              { icon: "📦", label: "Warehouse & Inventory" },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
                <span className="text-base">{m.icon}</span>
                <span className="text-[13px] font-medium">{m.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 text-white/30 text-[10px] tracking-wide">
            © 2026 AUTOMYSTICS TECHNOLOGIES PVT. LTD.
          </div>
        </div>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8"
        style={{ background: "#FFFBF0" }}>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 justify-center mb-8 lg:hidden">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}>
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">Mystics ERP</span>
          </div>

          <div className="mb-7">
            <h1 className="text-[22px] font-bold text-gray-900">Sign in to your account</h1>
            <p className="text-[13px] text-gray-500 mt-1">Solar EPC Control Platform</p>
          </div>

          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-7">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-gray-700">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@automystics.com" {...field}
                        className="h-10 bg-orange-50/40 border-orange-100 text-[13px] focus-visible:ring-orange-300" />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-gray-700">Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field}
                        className="h-10 bg-orange-50/40 border-orange-100 text-[13px] focus-visible:ring-orange-300" />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <Button type="submit"
                  className="w-full h-10 text-[14px] font-semibold text-white border-0"
                  style={{ background: "linear-gradient(90deg, #f59e0b, #ea580c)" }}
                  disabled={loginMutation.isPending}>
                  {loginMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in…</>
                    : "Sign In"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Demo accounts */}
          <div className="mt-5">
            <p className="text-[11px] text-gray-400 text-center mb-2">Demo accounts — click to fill:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Admin", email: "admin@automystics.com", pw: "admin123" },
                { label: "Sales", email: "rajan@automystics.com", pw: "sales123" },
                { label: "PM", email: "priya@automystics.com", pw: "pm123" },
                { label: "Warehouse", email: "kiran@automystics.com", pw: "wh123" },
              ].map((acc) => (
                <button key={acc.label} type="button"
                  onClick={() => { form.setValue("email", acc.email); form.setValue("password", acc.pw); }}
                  className="text-[11px] text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg py-1.5 px-2 font-medium transition-colors text-left">
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
