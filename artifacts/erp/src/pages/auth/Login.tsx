import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";

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
    <div className="min-h-screen flex bg-white selection:bg-[#EA580C] selection:text-white">
      {/* ── Left: Branding & Graphic ── */}
      <div className="hidden lg:flex w-[45%] flex-col relative overflow-hidden bg-[#0A0F2C]">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-30 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F2C] via-[#0A0F2C]/80 to-transparent" />
        
        <div className="relative z-10 flex flex-col h-full p-12 lg:p-16 text-white">
          <div className="flex items-center gap-3 mb-auto">
            <div className="h-10 w-10 rounded-[8px] flex items-center justify-center bg-gradient-to-br from-[#F97316] to-[#EA580C] shadow-[0_0_20px_rgba(234,88,12,0.4)]">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-xl leading-tight tracking-tight">Solar EPC</div>
              <div className="text-[11px] font-bold text-white/50 tracking-widest uppercase">Automystics Technologies</div>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="mb-12"
          >
            <h1 className="text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight mb-6">
              Command Center <br/>
              <span className="text-[#EA580C]">for Solar EPC.</span>
            </h1>
            <p className="text-white/60 text-lg leading-relaxed max-w-md font-medium">
              Precision execution from lead acquisition to site commissioning and stock ledger management.
            </p>
          </motion.div>

          <div className="mt-auto flex items-center justify-between text-[11px] font-bold tracking-widest text-white/30 uppercase">
            <span>© 2026 Automystics</span>
            <span>v2.4.0</span>
          </div>
        </div>
      </div>

      {/* ── Right: Login Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-[#FAFAFA]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 justify-center mb-10 lg:hidden">
            <div className="h-10 w-10 rounded-[8px] flex items-center justify-center bg-gradient-to-br from-[#F97316] to-[#EA580C]">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 tracking-tight">Solar EPC</span>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Sign in</h2>
            <p className="text-sm text-gray-500 mt-2">Enter your credentials to access the workspace.</p>
          </div>

          <div className="bg-white rounded-[16px] premium-shadow p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-gray-900 uppercase tracking-wide">Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="name@automystics.com" 
                        {...field}
                        className="h-11 bg-gray-50/50 border-gray-200 text-sm focus-visible:ring-[#EA580C] focus-visible:border-[#EA580C] transition-all" 
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-500" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-bold text-gray-900 uppercase tracking-wide">Password</FormLabel>
                      <span className="text-xs font-medium text-[#EA580C] hover:text-[#C2410C] cursor-pointer transition-colors">Forgot?</span>
                    </div>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field}
                        className="h-11 bg-gray-50/50 border-gray-200 text-sm focus-visible:ring-[#EA580C] focus-visible:border-[#EA580C] transition-all" 
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-500" />
                  </FormItem>
                )} />
                <Button type="submit"
                  className="w-full h-11 text-sm font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] transition-all rounded-[8px] mt-2 shadow-sm"
                  disabled={loginMutation.isPending}>
                  {loginMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Authenticating…</>
                    : "Sign In"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Demo accounts */}
          <div className="mt-8 text-center">
            <p className="text-xs font-medium text-gray-400 mb-3">Quick access (Demo only)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Super Admin", email: "superadmin@automystics.com", pw: "superadmin123" },
                { label: "Admin", email: "admin@automystics.com", pw: "admin123" },
                { label: "Sales", email: "meera@automystics.com", pw: "sales123" },
                { label: "PM", email: "vikram@automystics.com", pw: "pm123" },
                { label: "Warehouse", email: "santosh@automystics.com", pw: "wh123" },
              ].map((acc) => (
                <button key={acc.label} type="button"
                  onClick={() => { form.setValue("email", acc.email); form.setValue("password", acc.pw); }}
                  className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 rounded-[8px] py-2 px-3 transition-colors text-center">
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
