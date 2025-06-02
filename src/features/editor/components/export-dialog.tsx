"use client";
import { fabric } from "fabric";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { jsPDF } from "jspdf";
import { FileType, ImageIcon, Image, Palette } from "lucide-react";

interface ExportDialogProps {
  editor: any;
  dataSources: Record<
    string,
    {
      endpoint: string;
      method: string;
      headers: Record<string, string>;
      data: any;
      timestamp: string;
    }
  >;
  onClose: () => void;
  includeBackground?: boolean;
}

export function ExportDialog({
  editor,
  dataSources,
  onClose,
  includeBackground = true,
}: ExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<"png" | "pdf">("pdf");
  const [dataSourceId, setDataSourceId] = useState<string>("");
  const [dataPath, setDataPath] = useState<string>("");
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(10);
  const [maxItems, setMaxItems] = useState(0);
  const [fileName, setFileName] = useState("design-export");
  const [isExporting, setIsExporting] = useState(false);
  const [includeAllPages, setIncludeAllPages] = useState(true);

  const [backgroundOption, setBackgroundOption] = useState<"include" | "none">(
    "include",
  );
  const [hasBackgroundImage, setHasBackgroundImage] = useState(false);
  const [hasBackgroundColor, setHasBackgroundColor] = useState(false);
  const [backgroundColorValue, setBackgroundColorValue] = useState("#ffffff");

  useEffect(() => {
    if (dataSourceId && dataSources[dataSourceId]) {
      const data = dataSources[dataSourceId].data;
      const arrayPath = findFirstArrayPath(data);
      setDataPath(arrayPath || "");
      const arrayData = arrayPath ? getValueByPath(data, arrayPath) : null;
      if (Array.isArray(arrayData)) {
        setMaxItems(arrayData.length - 1);
        setEndIndex(Math.min(10, arrayData.length - 1));
      } else {
        setMaxItems(0);
        setEndIndex(0);
      }
    }
  }, [dataSourceId, dataSources]);

  useEffect(() => {
    if (editor?.canvas) {
      const workspace = editor.getWorkspace();
      const backgroundInfo = editor.getBackgroundImageInfo?.();

      setHasBackgroundImage(!!backgroundInfo);
      setHasBackgroundColor(
        workspace?.fill && workspace.fill !== "transparent",
      );
      setBackgroundColorValue(workspace?.fill || "#ffffff");
    }
  }, [editor]);

  const findFirstArrayPath = (data: any, path = ""): string => {
    if (!data || typeof data !== "object") return "";
    if (Array.isArray(data)) return path;
    for (const key in data) {
      const newPath = path ? `${path}.${key}` : key;
      if (typeof data[key] === "object" && data[key] !== null) {
        const result = findFirstArrayPath(data[key], newPath);
        if (result) return result;
      }
    }
    return "";
  };

  const getValueByPath = (obj: any, path: string): any => {
    if (!path) return obj;
    return path.split(".").reduce((o, key) => (o ? o[key] : undefined), obj);
  };

  const getBackgroundIncludeFlag = (): boolean => {
    return backgroundOption === "include";
  };

  const handleExport = async () => {
    if (!editor?.canvas) return;
    setIsExporting(true);
    try {
      if (exportFormat === "png") {
        await exportAsPNG();
      } else {
        if (
          dataSourceId &&
          dataSourceId !== "none" &&
          dataSources[dataSourceId]
        ) {
          await exportAsPDF();
        } else {
          await exportSinglePDF();
        }
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export");
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPNG = async () => {
    const includeImageBackground = getBackgroundIncludeFlag();
    editor.savePng(includeImageBackground);
  };

  const exportSinglePDF = async () => {
    if (!editor?.canvas) return;

    const workspace = editor.getWorkspace() as fabric.Rect;
    let tempBackground: fabric.Image | null = null;
    let originalWorkspaceFill: string | undefined;

    if (backgroundOption === "none") {
      const backgroundImage = editor.canvas
        .getObjects()
        .find((obj: any) => obj.name === "backgroundImage");
      if (backgroundImage) {
        tempBackground = backgroundImage;
        editor.canvas.remove(backgroundImage);
        editor.canvas.renderAll();
      }
      originalWorkspaceFill = workspace.fill as string;
      workspace.set({ fill: "transparent" });
      editor.canvas.renderAll();
    } else {
      const currentFill = workspace.fill || "#ffffff";
      workspace.set({ fill: currentFill });
      editor.canvas.renderAll();
    }

    editor.savePdf(backgroundOption === "include");

    if (tempBackground) {
      editor.canvas.add(tempBackground);
      tempBackground.moveTo(1);
      editor.canvas.renderAll();
    }

    if (backgroundOption === "none" && originalWorkspaceFill) {
      workspace.set({ fill: originalWorkspaceFill });
      editor.canvas.renderAll();
    }

    editor.autoZoom();
  };

  const exportAsPDF = async () => {
    if (!editor?.canvas || !dataSourceId || !dataSources[dataSourceId]) {
      await exportSinglePDF();
      return;
    }

    const sourceData = dataSources[dataSourceId].data;
    const dataArray = dataPath ? getValueByPath(sourceData, dataPath) : null;

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      await exportSinglePDF();
      return;
    }

    const workspace = editor.getWorkspace() as fabric.Rect;
    const { width, height, left, top } = editor.generateSaveOptions();

    const pdf = new jsPDF({
      orientation: width > height ? "landscape" : "portrait",
      unit: "px",
      format: [width, height],
    });

    let tempBackground: fabric.Image | null = null;
    let originalWorkspaceFill: string | undefined;

    if (backgroundOption === "none") {
      const backgroundImage = editor.canvas
        .getObjects()
        .find((obj: any) => obj.name === "backgroundImage");
      if (backgroundImage) {
        tempBackground = backgroundImage;
        editor.canvas.remove(backgroundImage);
        editor.canvas.renderAll();
      }
      originalWorkspaceFill = workspace.fill as string;
      workspace.set({ fill: "transparent" });
      editor.canvas.renderAll();
    } else {
      const currentFill = workspace.fill || "#ffffff";
      workspace.set({ fill: currentFill });
      editor.canvas.renderAll();
    }

    const start = includeAllPages ? 0 : Math.max(0, startIndex);
    const end = includeAllPages
      ? dataArray.length - 1
      : Math.min(endIndex, dataArray.length - 1);

    for (let i = start; i <= end; i++) {
      if (i > start) {
        pdf.addPage([width, height], width > height ? "landscape" : "portrait");
      }

      const dynamicTextObjects = editor.canvas
        .getObjects()
        .filter(
          (obj: any) =>
            obj.get("isDynamic") &&
            obj.type === "textbox" &&
            !obj.get("qrUrl") &&
            obj.get("fieldPath"),
        );

      for (const obj of dynamicTextObjects) {
        const fieldPath = obj.get("fieldPath");
        editor.updateDynamicText(dataSourceId, fieldPath, i, sourceData);
      }

      const qrObjects = editor.canvas
        .getObjects()
        .filter(
          (obj: any) =>
            obj.get("isDynamic") &&
            obj.get("qrUrl") &&
            obj.get("fieldPath") &&
            obj.type !== "textbox",
        );

      for (const obj of qrObjects) {
        const fieldPath = obj.get("fieldPath");
        await editor.updateDynamicQRCodes(
          dataSourceId,
          fieldPath,
          i,
          sourceData,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      editor.canvas.renderAll();

      workspace.set({ visible: false });
      editor.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

      const dataURL = editor.canvas.toDataURL({
        format: "png",
        quality: 1,
        left,
        top,
        width,
        height,
      });

      pdf.addImage(dataURL, "PNG", 0, 0, width, height);

      workspace.set({ visible: true });
      editor.canvas.renderAll();
    }

    if (tempBackground) {
      editor.canvas.add(tempBackground);
      tempBackground.moveTo(1);
      editor.canvas.renderAll();
    }

    if (backgroundOption === "none" && originalWorkspaceFill) {
      workspace.set({ fill: originalWorkspaceFill });
      editor.canvas.renderAll();
    }

    pdf.save(`${fileName}.pdf`);
    editor.autoZoom();
  };

  const getBackgroundOptionDescription = () => {
    switch (backgroundOption) {
      case "include":
        return "Include both background color and image (if present)";
      case "none":
        return "Exclude background";
      default:
        return "";
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Design</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="options" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="options" className="flex-1">
              Options
            </TabsTrigger>
            <TabsTrigger value="background" className="flex-1">
              Background
            </TabsTrigger>
            <TabsTrigger value="data" className="flex-1">
              Data Range
            </TabsTrigger>
          </TabsList>

          <TabsContent value="options" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="file-name">File Name</Label>
              <Input
                id="file-name"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="design-export"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-format">Export Format</Label>
              <Select
                value={exportFormat}
                onValueChange={(value: "png" | "pdf") => setExportFormat(value)}
              >
                <SelectTrigger id="export-format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">
                    <div className="flex items-center">
                      <ImageIcon className="mr-2 h-4 w-4" />
                      PNG Image
                    </div>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <div className="flex items-center">
                      <FileType className="mr-2 h-4 w-4" />
                      PDF Document
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {exportFormat === "pdf" && (
              <div className="space-y-2">
                <Label htmlFor="data-source">
                  Data Source for Multi-page PDF
                </Label>
                <Select value={dataSourceId} onValueChange={setDataSourceId}>
                  <SelectTrigger id="data-source">
                    <SelectValue placeholder="Select data source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Single Page)</SelectItem>
                    {Object.keys(dataSources).map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          <TabsContent value="background" className="space-y-4 pt-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Background Options</Label>

              <div className="space-y-1 rounded-md bg-muted p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Palette className="h-3 w-3" />
                  <span>
                    Background Color: {hasBackgroundColor ? "Yes" : "None"}
                  </span>
                  {hasBackgroundColor && (
                    <div
                      className="h-4 w-4 rounded border border-gray-300"
                      style={{ backgroundColor: backgroundColorValue }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Image className="h-3 w-3" />
                  <span>
                    Background Image: {hasBackgroundImage ? "Yes" : "None"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="bg-include"
                    name="background"
                    value="include"
                    checked={backgroundOption === "include"}
                    onChange={(e) => setBackgroundOption(e.target.value as any)}
                    className="h-4 w-4"
                  />
                  <Label
                    htmlFor="bg-include"
                    className="cursor-pointer text-sm"
                  >
                    Include Background
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="bg-none"
                    name="background"
                    value="none"
                    checked={backgroundOption === "none"}
                    onChange={(e) => setBackgroundOption(e.target.value as any)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="bg-none" className="cursor-pointer text-sm">
                    No Background
                  </Label>
                </div>
              </div>

              <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                <p className="mb-1 font-medium">Selected Option:</p>
                <p>{getBackgroundOptionDescription()}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-4 pt-4">
            {dataSourceId &&
            dataSourceId !== "none" &&
            dataSources[dataSourceId] ? (
              <>
                {dataPath ? (
                  <>
                    <div className="rounded-md bg-muted p-2 text-xs">
                      <p>
                        Data array found at: <strong>{dataPath}</strong>
                      </p>
                      <p>Items: {maxItems + 1}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="include-all"
                        checked={includeAllPages}
                        onCheckedChange={(checked) =>
                          setIncludeAllPages(!!checked)
                        }
                      />
                      <Label htmlFor="include-all" className="text-sm">
                        Include all items ({maxItems + 1} pages)
                      </Label>
                    </div>
                    {!includeAllPages && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-index">Start Index</Label>
                          <Input
                            id="start-index"
                            type="number"
                            min="0"
                            max={maxItems}
                            value={startIndex}
                            onChange={(e) =>
                              setStartIndex(
                                Number.parseInt(e.target.value) || 0,
                              )
                            }
                            disabled={includeAllPages}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-index">End Index</Label>
                          <Input
                            id="end-index"
                            type="number"
                            min={startIndex}
                            max={maxItems}
                            value={endIndex}
                            onChange={(e) =>
                              setEndIndex(Number.parseInt(e.target.value) || 0)
                            }
                            disabled={includeAllPages}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          This will generate {endIndex - startIndex + 1} pages
                          in the PDF.
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No array data found in this data source. The export will be
                    a single page.
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                {!dataSourceId || dataSourceId === "none"
                  ? "Select a data source to enable multi-page export"
                  : "Selected data source contains no data"}
              </div>
            )}
          </TabsContent>
        </Tabs>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
