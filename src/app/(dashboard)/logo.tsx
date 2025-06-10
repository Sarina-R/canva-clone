import Link from "next/link";
import Image from "next/image";
import { Space_Grotesk } from "next/font/google";

import { cn } from "@/lib/utils";

const font = Space_Grotesk({
  weight: ["700"],
  subsets: ["latin"],
});

export const Logo = () => {
  return (
    <Link href="/">
      <div className="flex h-[68px] items-center gap-x-2 px-4 transition hover:opacity-75">
        <div className="relative size-8">
          <Image
            src="/logo.png"
            alt="AVIS Design"
            fill
            className="object-contain"
          />
        </div>
        <h1 className={cn(font.className, "text-xl font-bold")}>AVIS Design</h1>
      </div>
    </Link>
  );
};
