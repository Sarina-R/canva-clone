"use client";

import { useState } from "react";
import { CiFileOn } from "react-icons/ci";
import { BsCloudCheck, BsCloudSlash } from "react-icons/bs";
import { useFilePicker } from "use-file-picker";
import { useMutationState } from "@tanstack/react-query";
import {
  ChevronDown,
  Download,
  Loader,
  MousePointerClick,
  Redo2,
  Undo2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/features/auth/components/user-button";
import { ExportDialog } from "@/features/editor/components/export-dialog";
import { ActiveTool, Editor } from "@/features/editor/types";
import { Logo } from "@/features/editor/components/logo";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDataSources } from "@/features/editor/context/data-source-context";

interface NavbarProps {
  id: string;
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
}

export const Navbar = ({
  id,
  editor,
  activeTool,
  onChangeActiveTool,
}: NavbarProps) => {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showBackgroundChoiceDialog, setShowBackgroundChoiceDialog] =
    useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<
    "png" | "jpg" | "svg" | "pdf" | null
  >(null);
  const { dataSources } = useDataSources();

  const data = useMutationState({
    filters: {
      mutationKey: ["project", { id }],
      exact: true,
    },
    select: (mutation) => mutation.state.status,
  });

  const currentStatus = data[data.length - 1];
  const isError = currentStatus === "error";
  const isPending = currentStatus === "pending";

  const { openFilePicker } = useFilePicker({
    accept: ".json",
    onFilesSuccessfullySelected: ({ plainFiles }: any) => {
      if (plainFiles && plainFiles.length > 0) {
        const file = plainFiles[0];
        const reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = () => {
          editor?.loadJson(reader.result as string);
        };
      }
    },
  });

  const handleExportChoice = (includeBackground: boolean) => {
    if (!selectedExportFormat) return;
    if (selectedExportFormat === "png") {
      editor?.savePng(includeBackground);
    } else if (selectedExportFormat === "jpg") {
      editor?.saveJpg(includeBackground);
    } else if (selectedExportFormat === "svg") {
      editor?.saveSvg(includeBackground);
    } else if (selectedExportFormat === "pdf") {
      editor?.savePdf(includeBackground);
    }
    setShowBackgroundChoiceDialog(false);
    setSelectedExportFormat(null);
  };

  const openBackgroundChoiceDialog = (
    format: "png" | "jpg" | "svg" | "pdf",
  ) => {
    setSelectedExportFormat(format);
    setShowBackgroundChoiceDialog(true);
  };

  const handleDynamicPdfExport = () => {
    setShowExportDialog(true);
  };

  return (
    <>
      <nav className="flex h-[68px] w-full items-center gap-x-8 border-b p-4 lg:pl-[34px]">
        <Logo />
        <div className="flex h-full w-full items-center gap-x-1">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                File
                <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-60">
              <DropdownMenuItem
                onClick={() => openFilePicker()}
                className="flex items-center gap-x-2"
              >
                <CiFileOn className="size-8" />
                <div>
                  <p>Open</p>
                  <p className="text-xs text-muted-foreground">
                    Open a JSON file
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="mx-2" />
          <Hint label="Select" side="bottom" sideOffset={10}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChangeActiveTool("select")}
              className={cn(activeTool === "select" && "bg-gray-100")}
            >
              <MousePointerClick className="size-4" />
            </Button>
          </Hint>
          <Hint label="Undo" side="bottom" sideOffset={10}>
            <Button
              disabled={!editor?.canUndo()}
              variant="ghost"
              size="icon"
              onClick={() => editor?.onUndo()}
            >
              <Undo2 className="size-4" />
            </Button>
          </Hint>
          <Hint label="Redo" side="bottom" sideOffset={10}>
            <Button
              disabled={!editor?.canRedo()}
              variant="ghost"
              size="icon"
              onClick={() => editor?.onRedo()}
            >
              <Redo2 className="size-4" />
            </Button>
          </Hint>
          <Separator orientation="vertical" className="mx-2" />
          {isPending && (
            <div className="flex items-center gap-x-2">
              <Loader className="size-4 animate-spin text-muted-foreground" />
              <div className="text-xs text-muted-foreground">Saving...</div>
            </div>
          )}
          {!isPending && isError && (
            <div className="flex items-center gap-x-2">
              <BsCloudSlash className="size-[20px] text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                Failed to save
              </div>
            </div>
          )}
          {!isPending && !isError && (
            <div className="flex items-center gap-x-2">
              <BsCloudCheck className="size-[20px] text-muted-foreground" />
              <div className="text-xs text-muted-foreground">Saved</div>
            </div>
          )}
          <div className="ml-auto flex items-center gap-x-4">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  Export
                  <Download className="ml-4 size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-60">
                <DropdownMenuItem
                  className="flex items-center gap-x-2"
                  onClick={() => editor?.saveJson()}
                >
                  <CiFileOn className="size-8" />
                  <div>
                    <p>JSON</p>
                    <p className="text-xs text-muted-foreground">
                      Save for later editing
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-x-2"
                  onClick={() => openBackgroundChoiceDialog("png")}
                >
                  <CiFileOn className="size-8" />
                  <div>
                    <p>PNG</p>
                    <p className="text-xs text-muted-foreground">
                      Best for sharing on the web
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-x-2"
                  onClick={() => openBackgroundChoiceDialog("jpg")}
                >
                  <CiFileOn className="size-8" />
                  <div>
                    <p>JPG</p>
                    <p className="text-xs text-muted-foreground">
                      Best for printing
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-x-2"
                  onClick={() => openBackgroundChoiceDialog("svg")}
                >
                  <CiFileOn className="size-8" />
                  <div>
                    <p>SVG</p>
                    <p className="text-xs text-muted-foreground">
                      Best for editing in vector software
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-x-2"
                  onClick={handleDynamicPdfExport}
                >
                  <CiFileOn className="size-8" />
                  <div>
                    <p>Dynamic PDF</p>
                    <p className="text-xs text-muted-foreground">
                      Multi-page PDF with dynamic text
                    </p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <UserButton />
          </div>
        </div>
      </nav>
      {showBackgroundChoiceDialog && (
        <Dialog
          open={true}
          onOpenChange={() => setShowBackgroundChoiceDialog(false)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Export Options</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Do you want to include the background image in the export?
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleExportChoice(false)}
                >
                  Without Background
                </Button>
                <Button onClick={() => handleExportChoice(true)}>
                  With Background
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {showExportDialog && (
        <ExportDialog
          editor={editor}
          dataSources={dataSources}
          onClose={() => setShowExportDialog(false)}
          includeBackground={true}
        />
      )}
    </>
  );
};
