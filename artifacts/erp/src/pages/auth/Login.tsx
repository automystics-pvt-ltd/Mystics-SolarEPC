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
import { HardHat } from "lucide-react";
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
    defaultValues: {
      email: "",
      password: "",
    },
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
          description: error.message || "Invalid credentials",
          variant: "destructive",
        });
      },
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-primary rounded-xl flex items-center justify-center mb-6 shadow-xl shadow-primary/20">
            <HardHat className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-sidebar-foreground tracking-tight">Mystics ERP</h1>
          <p className="text-sidebar-foreground/60 mt-2">Engineering & Project Control</p>
        </div>

        <div className="bg-card border border-border shadow-2xl rounded-xl p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@automystics.com" {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-11 text-base font-semibold" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Authenticating..." : "Sign In"}
              </Button>
            </form>
          </Form>
        </div>
        <div className="mt-8 text-center text-sm text-sidebar-foreground/40">
          Secure Access Portal • Automystics Technologies
        </div>
      </div>
    </div>
  );
}
