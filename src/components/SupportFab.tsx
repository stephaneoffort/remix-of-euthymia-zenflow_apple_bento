import { LifeBuoy } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const HIDDEN_ROUTES = ["/auth", "/select-member", "/reset-password", "/install", "/.lovable", "/support"];

export default function SupportFab() {
  const location = useLocation();
  const navigate = useNavigate();

  if (HIDDEN_ROUTES.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate("/support")}
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:shadow-xl transition-shadow"
      title="Signaler un bug / demander de l'aide"
      aria-label="Support"
    >
      <LifeBuoy className="w-5 h-5" />
    </motion.button>
  );
}
