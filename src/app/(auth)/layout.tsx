"use client";

import Aurora from "@/components/Aurora";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-black">
      <Aurora blend={0.7} amplitude={1.0} speed={0.5} />
      <div className="fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(0,0,0,0.6),rgba(0,0,0,0.3),rgba(0,0,0,0.6))]" />
      <div className="z-[4] flex h-full w-full flex-col items-center justify-center">
        <div className="h-full w-full md:h-auto md:w-[420px]">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;
