import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, SearchX } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }}
        className="text-center max-w-sm mx-auto">
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
          <SearchX className="h-9 w-9 text-muted-foreground" />
        </div>
        <h1 className="text-5xl font-bold text-foreground tabular-nums mb-2">404</h1>
        <h2 className="text-[17px] font-semibold text-foreground mb-2">Page not found</h2>
        <p className="text-[13px] text-muted-foreground mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2 text-[13px]">
            <ArrowLeft className="h-4 w-4" /> Go back
          </Button>
          <Button onClick={() => setLocation("/dashboard")} className="gap-2 text-[13px] bg-primary hover:bg-primary/90">
            <Home className="h-4 w-4" /> Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
