"use client";

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
import { FileType, ImageIcon } from "lucide-react";

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
}

export function ExportDialog({
  editor,
  dataSources,
  onClose,
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

  const handleExport = async () => {
    if (!editor?.canvas) return;
    setIsExporting(true);
    try {
      if (exportFormat === "png") {
        editor.savePng();
      } else {
        if (
          dataSourceId &&
          dataSourceId !== "none" &&
          dataSources[dataSourceId]
        ) {
          await exportAsPDF();
        } else {
          editor.savePdf();
        }
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export");
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!editor?.canvas || !dataSourceId || !dataSources[dataSourceId]) {
      editor.savePdf();
      return;
    }

    const sourceData = dataSources[dataSourceId].data;
    const dataArray = dataPath ? getValueByPath(sourceData, dataPath) : null;

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      editor.savePdf();
      return;
    }

    // Get workspace dimensions
    const workspace = editor.getWorkspace() as fabric.Rect;
    const width =
      workspace?.width && workspace.width > 0
        ? workspace.width
        : editor.canvas.getWidth() || 1200;

    const height =
      workspace?.height && workspace.height > 0
        ? workspace.height
        : editor.canvas.getHeight() || 900;

    console.log("Multi-page PDF dimensions:", width, height);

    const start = includeAllPages ? 0 : Math.max(0, startIndex);
    const end = includeAllPages
      ? dataArray.length - 1
      : Math.min(endIndex, dataArray.length - 1);

    const pdf = new jsPDF({
      orientation: width > height ? "landscape" : "portrait",
      unit: "px",
      format: [width, height],
    });

    const originalJSON = editor.canvas.toJSON();

    for (let i = start; i <= end; i++) {
      if (i >= dataArray.length) break;
      if (i > start) {
        pdf.addPage([width, height], width > height ? "landscape" : "portrait");
      }

      editor.canvas.getObjects().forEach((obj: any) => {
        if (obj.get("isDynamic") && obj.get("dataSourceId") === dataSourceId) {
          const fieldPath = obj.get("fieldPath");
          if (fieldPath) {
            editor.updateDynamicText(dataSourceId, fieldPath, i, sourceData);
          }
        }
      });

      await new Promise((resolve) => {
        editor.canvas.renderAll();
        setTimeout(resolve, 10);
      });

      // Reset view transform to ensure correct rendering
      editor.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

      const dataURL = editor.canvas.toDataURL({
        format: "png",
        quality: 1,
        width: width,
        height: height,
      });

      pdf.addImage(dataURL, "PNG", 0, 0, width, height);
    }

    editor.canvas.loadFromJSON(originalJSON, () => {
      editor.canvas.renderAll();
    });

    pdf.save(`${fileName}.pdf`);
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
