import React, { useState } from "react";
import QRCodeSVG from "react-qr-code";
import { cn } from "@/lib/utils";
import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fabric } from "fabric";
import * as ReactDOM from "react-dom";

interface QRCodeSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
}

export const QRCodeSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: QRCodeSidebarProps) => {
  const { toast } = useToast();
  const [text, setText] = useState("https://example.com");

  const onClose = () => {
    onChangeActiveTool("select");
  };

  const handleAddQRCode = () => {
    if (!editor || !text) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid URL or text.",
      });
      return;
    }

    const qrUrl = text;

    // Create a temporary container to render QR code SVG
    const qrContainer = document.createElement("div");
    qrContainer.style.position = "absolute";
    qrContainer.style.visibility = "hidden";
    document.body.appendChild(qrContainer);

    // Render QRCodeSVG to get the SVG string
    ReactDOM.render(
      <QRCodeSVG
        value={qrUrl}
        size={200}
        bgColor="#ffffff"
        fgColor="#000000"
        level="Q"
      />,
      qrContainer,
      () => {
        const svgElement = qrContainer.querySelector("svg");
        if (!svgElement) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to generate QR code SVG.",
          });
          document.body.removeChild(qrContainer);
          return;
        }

        // Get SVG string
        const svgString = new XMLSerializer().serializeToString(svgElement);

        // Load SVG into Fabric.js
        fabric.loadSVGFromString(svgString, (objects, options) => {
          const qrGroup = fabric.util.groupSVGElements(objects, {
            ...options,
            selectable: true,
            hasControls: true,
            qrUrl: qrUrl, // Store the URL for reference
          });

          // Scale and position the QR code
          qrGroup.scaleToWidth(200);
          qrGroup.scaleToHeight(200);
          editor.canvas.centerObject(qrGroup);
          editor.canvas.add(qrGroup);
          editor.canvas.setActiveObject(qrGroup);
          editor.canvas.renderAll();

          // Clean up
          document.body.removeChild(qrContainer);

          toast({
            title: "Success",
            description: `QR code for ${qrUrl} added to canvas.`,
          });

          onChangeActiveTool("select");
        });
      },
    );
  };

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-white",
        activeTool === "QrCode" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="QR Code Generator"
        description="Create a QR code and add it to your canvas"
      />
      <ScrollArea>
        <div className="space-y-4 p-4">
          <Input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text or URL"
            className="w-full text-sm"
          />
          <div className="flex justify-center">
            <QRCodeSVG
              value={text}
              size={200}
              bgColor="#ffffff"
              fgColor="#000000"
              level="Q"
            />
          </div>
          <Button
            className="w-full text-sm font-medium"
            onClick={handleAddQRCode}
            disabled={!text}
          >
            Add QR Code to Canvas
          </Button>
        </div>
      </ScrollArea>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
};

export default QRCodeSidebar;
