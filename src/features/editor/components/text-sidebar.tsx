import { useState } from "react";
import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";

interface TextSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
}

export const TextSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: TextSidebarProps) => {
  // const [position, setPosition] = useState<string>("center");

  const onClose = () => {
    onChangeActiveTool("select");
  };

  // const positions = ["header", "center", "sidebar", "footer"];

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-white",
        activeTool === "text" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Text" description="Add text to your canvas" />

      <ScrollArea>
        <div className="space-y-6 p-4">
          {/* <div className="space-y-2">
            <Label htmlFor="position">Position on Canvas</Label>
            <select
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos.charAt(0).toUpperCase() + pos.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4 border-b">
            <Button
              className="w-full"
              onClick={() =>
                editor?.addText("Event Name", {
                  text: "Event Name",
                  position: position,
                  fontSize: 48,
                  fontWeight: 700,
                })
              }
            >
              Add Event Name
            </Button>

            <Button
              className="w-full"
              variant="secondary"
              size="lg"
              onClick={() =>
                editor?.addText("Event Location", {
                  text: "Event Location",
                  position: position,
                  fontSize: 32,
                  fontWeight: 600,
                })
              }
            >
              Add Event Location
            </Button>

            <Button
              className="w-full"
              variant="secondary"
              size="lg"
              onClick={() =>
                editor?.addText("Event Date", {
                  text: "Event Date",
                  position: position,
                  fontSize: 28,
                })
              }
            >
              Add Event Date
            </Button>

            <Button
              className="w-full"
              variant="secondary"
              size="lg"
              onClick={() =>
                editor?.addText("Team League", {
                  text: "Team League",
                  position: position,
                  fontSize: 36,
                  fontWeight: 600,
                })
              }
            >
              Add Team League
            </Button>

            <Button
              className="w-full"
              variant="secondary"
              size="lg"
              onClick={() =>
                editor?.addText("Team Member", {
                  text: "Team Member",
                  position: position,
                  fontSize: 24,
                })
              }
            >
              Add Team Member
            </Button>
          </div> */}

          <Button className="w-full" onClick={() => editor?.addText("Textbox")}>
            Add a textbox
          </Button>
          <Button
            className="h-16 w-full"
            variant="secondary"
            size="lg"
            onClick={() =>
              editor?.addText("Heading", {
                fontSize: 80,
                fontWeight: 700,
              })
            }
          >
            <span className="text-3xl font-bold">Add a heading</span>
          </Button>
          <Button
            className="h-16 w-full"
            variant="secondary"
            size="lg"
            onClick={() =>
              editor?.addText("Subheading", {
                fontSize: 44,
                fontWeight: 600,
              })
            }
          >
            <span className="text-xl font-semibold">Add a subheading</span>
          </Button>
          <Button
            className="h-16 w-full"
            variant="secondary"
            size="lg"
            onClick={() =>
              editor?.addText("Paragraph", {
                fontSize: 32,
              })
            }
          >
            Paragraph
          </Button>
        </div>
      </ScrollArea>

      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
};
