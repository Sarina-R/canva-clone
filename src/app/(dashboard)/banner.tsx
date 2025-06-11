"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

import { useCreateProject } from "@/features/projects/api/use-create-project";
import { Button } from "@/components/ui/button";
import Squares from "@/components/Squares";

interface CreateProjectResponse {
  data: {
    id: string;
  };
}

export const Banner: React.FC = () => {
  const router = useRouter();
  const mutation = useCreateProject();

  const onClick = () => {
    mutation.mutate(
      {
        name: "Untitled project",
        json: "",
        width: 900,
        height: 1200,
      },
      {
        onSuccess: ({ data }: CreateProjectResponse) => {
          router.push(`/editor/${data.id}`);
        },
      },
    );
  };

  return (
    <div className="relative flex min-h-[248px] items-center gap-x-6 overflow-hidden rounded-xl p-6 text-white">
      <div className="absolute inset-0 z-0">
        <Squares
          direction="diagonal"
          speed={0.5}
          borderColor="#ffffff33"
          squareSize={30}
          hoverFillColor="#ffffff22"
        />
      </div>

      <div className="relative z-10 flex items-center gap-x-6">
        <div className="hidden size-28 items-center justify-center rounded-full bg-white/50 md:flex">
          <div className="flex size-20 items-center justify-center rounded-full bg-white">
            <Sparkles className="h-20 fill-[#0073ff] text-[#0073ff]" />
          </div>
        </div>
        <div className="flex flex-col gap-y-2">
          <h1 className="text-xl font-semibold md:text-3xl">
            Visualize your ideas with AVIS Design
          </h1>
          <p className="mb-2 text-xs md:text-sm">
            Turn inspiration into design in no time. Simply upload an image and
            let AI do the rest.
          </p>
          <Button
            disabled={mutation.isPending}
            onClick={onClick}
            variant="secondary"
            className="w-[160px]"
          >
            Start creating
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Banner;
