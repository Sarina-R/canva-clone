import Link from "next/link";
import Image from "next/image";

export const Logo = () => {
  return (
    <Link href="/">
      <div className="relative size-8 shrink-0">
        <Image
          src="/logo.png"
          fill
          alt="AVIS Design"
          className="shrink-0 object-contain transition hover:opacity-75"
        />
      </div>
    </Link>
  );
};
