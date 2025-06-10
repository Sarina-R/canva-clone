"use client";

import {
  // CreditCard,
  Crown,
  Home,
  MessageCircleQuestion,
  FileIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { Loader } from "lucide-react";

import { usePaywall } from "@/features/subscriptions/hooks/use-paywall";
import { useCheckout } from "@/features/subscriptions/api/use-checkout";
// import { useBilling } from "@/features/subscriptions/api/use-billing";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { SidebarItem } from "./sidebar-item";

export const SidebarRoutes = () => {
  const mutation = useCheckout();
  // const billingMutation = useBilling();
  const { shouldBlock, isLoading, triggerPaywall } = usePaywall();
  const { data, status } = useGetProjects();

  const pathname = usePathname();

  // const onClick = () => {
  //   if (shouldBlock) {
  //     triggerPaywall();
  //     return;
  //   }

  //   billingMutation.mutate();
  // };

  return (
    <div className="flex flex-1 flex-col gap-y-4">
      {shouldBlock && !isLoading && (
        <>
          <div className="px-3">
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full rounded-xl border-none transition hover:bg-white hover:opacity-75"
              variant="outline"
              size="lg"
            >
              <Crown className="mr-2 size-4 fill-yellow-500 text-yellow-500" />
              Upgrade to AVIS Design Pro
            </Button>
          </div>
          <div className="px-3">
            <Separator />
          </div>
        </>
      )}
      <ul className="flex flex-col gap-y-1 px-3">
        <SidebarItem
          href="/"
          icon={Home}
          label="Home"
          isActive={pathname === "/"}
        />
      </ul>
      <div className="px-3">
        <Separator />
      </div>
      <div className="flex flex-col gap-y-2 px-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Recent Projects
        </h4>
        {status === "pending" && (
          <div className="flex items-center justify-center py-2">
            <Loader className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {status === "error" && (
          <div className="py-2 text-sm text-muted-foreground">
            Failed to load projects
          </div>
        )}
        {status === "success" &&
          (!data.pages.length || !data.pages[0].data.length) && (
            <div className="py-2 text-sm text-muted-foreground">
              No projects found
            </div>
          )}
        {status === "success" &&
          data.pages.length > 0 &&
          data.pages[0].data.length > 0 && (
            <ul className="flex flex-col gap-y-1">
              {data.pages[0].data.map((project) => (
                <SidebarItem
                  key={project.id}
                  href={`/editor/${project.id}`}
                  icon={FileIcon}
                  label={project.name}
                  isActive={pathname === `/editor/${project.id}`}
                />
              ))}
            </ul>
          )}
      </div>
      <div className="px-3">
        <Separator />
      </div>
      <ul className="flex flex-col gap-y-1 px-3">
        <SidebarItem
          href="mailto:support@avisengine.com"
          icon={MessageCircleQuestion}
          label="Get Help"
        />
        {/* <SidebarItem
          href={pathname}
          icon={CreditCard}
          label="Billing"
          onClick={onClick}
        /> */}
      </ul>
    </div>
  );
};
