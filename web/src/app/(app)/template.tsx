"use client";

import { motion } from "motion/react";

// Un template est remonté à chaque navigation : la transition d'entrée se rejoue entre les pages.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
