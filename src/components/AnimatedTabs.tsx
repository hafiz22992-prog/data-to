import React, { useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type Tab = {
  title: string;
  value: string;
  icon: LucideIcon;
  content?: React.ReactNode;
};

export function AnimatedTabs({
  tabs,
  containerClassName,
  activeTabClassName,
  tabClassName,
  contentClassName,
}: {
  tabs: Tab[];
  containerClassName?: string;
  activeTabClassName?: string;
  tabClassName?: string;
  contentClassName?: string;
}) {
  const [active, setActive] = useState<Tab>(tabs[0]);

  return (
    <>
      {/* Tab bar */}
      <div
        className={`flex flex-row items-center justify-start [perspective:1000px] relative overflow-auto sm:overflow-visible no-visible-scrollbar max-w-full w-full ${containerClassName ?? ""}`}
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActive(tab)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${tabClassName ?? ""}`}
            style={{ transformStyle: "preserve-3d" }}
          >
            {active.value === tab.value && (
              <motion.div
                layoutId="active-tab-bg"
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                className={`absolute inset-0 rounded-full ${activeTabClassName ?? "bg-primary text-primary-foreground"}`}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <tab.icon className="size-4" />
              <span className="text-sm font-semibold">{tab.title}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Tab content with fade */}
      <motion.div
        key={active.value}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`mt-6 ${contentClassName ?? ""}`}
      >
        {active.content}
      </motion.div>
    </>
  );
}
