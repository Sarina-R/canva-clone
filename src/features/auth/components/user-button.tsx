"use client";

import { useSession, signOut } from "next-auth/react";
import { Crown, Loader, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePaywall } from "@/features/subscriptions/hooks/use-paywall";
// import { useBilling } from "@/features/subscriptions/api/use-billing";

export const UserButton = () => {
  const { shouldBlock, triggerPaywall, isLoading } = usePaywall();
  // const mutation = useBilling();
  const session = useSession();

  // const onClick = () => {
  //   if (shouldBlock) {
  //     triggerPaywall();
  //     return;
  //   }

  //   mutation.mutate();
  // };

  if (session.status === "loading") {
    return <Loader className="size-4 animate-spin text-muted-foreground" />;
  }

  if (session.status === "unauthenticated" || !session.data) {
    return null;
  }

  const name = session.data?.user?.name!;
  const imageUrl = session.data?.user?.image;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="relative outline-none">
        {shouldBlock && !isLoading && (
          <div className="absolute -left-1 -top-1 z-10 flex items-center justify-center">
            <div className="flex items-center justify-center rounded-full bg-white p-1 drop-shadow-sm">
              <Crown className="size-3 fill-yellow-500 text-yellow-500" />
            </div>
          </div>
        )}
        <Avatar className="size-10 transition hover:opacity-75">
          <AvatarImage alt={name} src={imageUrl || ""} />
          <AvatarFallback className="flex items-center justify-center bg-blue-500 font-medium text-white">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {/* <DropdownMenuItem
          disabled={mutation.isPending}
          onClick={onClick}
          className="h-10"
        >
          <CreditCard className="mr-2 size-4" />
          Billing
        </DropdownMenuItem> */}
        {/* <DropdownMenuSeparator /> */}
        <DropdownMenuItem className="h-10" onClick={() => signOut()}>
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
