"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useDataSources } from "@/features/editor/context/data-source-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fabric } from "fabric";

type FieldNode = {
  path: string;
  label: string;
  type: string;
  children?: FieldNode[];
  value?: any;
  isExpanded?: boolean;
};

interface DynamicTextSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
}

export const DynamicTextSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: DynamicTextSidebarProps) => {
  const { dataSources, setDataSources } = useDataSources();
  const { toast } = useToast();
  const [newSourceId, setNewSourceId] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceMethod, setNewSourceMethod] = useState("GET");
  const [newSourceHeaders, setNewSourceHeaders] = useState("");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState("");
  const [itemIndex, setItemIndex] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [fieldTree, setFieldTree] = useState<FieldNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (
      Object.keys(dataSources).length === 0 &&
      activeTool === "dynamic-text"
    ) {
      setShowAddDialog(true);
    }
  }, [dataSources, activeTool]);

  const formatFieldName = (fieldName: string): string => {
    return fieldName
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceId || !newSourceUrl) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Source name and API URL are required.",
      });
      return;
    }

    setIsLoading(true);
    try {
      let headers: Record<string, string> = {};
      if (newSourceHeaders.trim()) {
        headers = JSON.parse(newSourceHeaders);
      }

      const response = await fetch(newSourceUrl, {
        method: newSourceMethod,
        headers,
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      setDataSources({
        ...dataSources,
        [newSourceId]: {
          endpoint: newSourceUrl,
          method: newSourceMethod,
          headers,
          data,
          timestamp: new Date().toISOString(),
        },
      });

      setNewSourceId("");
      setNewSourceUrl("");
      setNewSourceMethod("GET");
      setNewSourceHeaders("");
      setShowAddDialog(false);
      toast({
        title: "Success",
        description: "Data source added successfully.",
      });
    } catch (error) {
      console.error("Error adding data source:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Failed to connect to the data source. Please check your URL and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshSource = async (sourceId: string) => {
    const source = dataSources[sourceId];
    if (!source) return;

    setIsLoading(true);
    try {
      const response = await fetch(source.endpoint, {
        method: source.method,
        headers: source.headers,
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      setDataSources({
        ...dataSources,
        [sourceId]: {
          ...dataSources[sourceId],
          data,
          timestamp: new Date().toISOString(),
        },
      });
      toast({
        title: "Success",
        description: "Data refreshed successfully.",
      });
    } catch (error) {
      console.error("Error refreshing data source:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh data. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getValueByPath = (obj: any, path: string, index: number) => {
    let current = obj;
    const parts = path
      .split(/[.[]/)
      .map((part) => part.replace(/\]$/, ""))
      .filter((part) => part !== "");
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (Array.isArray(current)) {
        if (!isNaN(Number(part))) {
          current = current[Number(part)];
        } else {
          current = current[index]?.[part];
        }
      } else {
        current = current[part];
      }
      if (current === undefined || current === null) {
        return "N/A";
      }
    }
    return current.toString();
  };

  const handleAddDynamicText = () => {
    if (!editor || !selectedSource || !selectedField) return;

    const data = dataSources[selectedSource]?.data;
    if (!data) return;

    const value = getValueByPath(data, selectedField, itemIndex);

    editor.addText(value, {
      fontSize: 20,
      fontFamily: "Arial",
      fill: "#000000",
    });

    const activeObject = editor.canvas.getActiveObject();
    if (activeObject) {
      activeObject.set("dataSourceId", selectedSource);
      activeObject.set("fieldPath", selectedField.replace(/\[\d+\]/g, ""));
      activeObject.set("itemIndex", itemIndex);
      activeObject.set("isDynamic", true);
      editor.canvas.renderAll();
    }

    onChangeActiveTool("select");
  };

  const handleAddQRCode = async () => {
    if (!editor || !selectedSource || !selectedField) return;

    const data = dataSources[selectedSource]?.data;
    if (!data) return;

    const userId = getValueByPath(data, selectedField, itemIndex);
    if (!userId || userId === "N/A") {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid data for QR code generation.",
      });
      return;
    }

    const qrUrl = `https://avisengien/${userId}`;
    const qrId = `qr-${selectedSource}-${selectedField.replace(/\[\d+\]/g, "")}-${itemIndex}`;

    const qrContainer = document.createElement("div");
    qrContainer.id = qrId;
    qrContainer.style.position = "absolute";
    qrContainer.style.visibility = "hidden";
    document.body.appendChild(qrContainer);

    const QRCodeSVG = (await import("react-qr-code")).default;
    const ReactDOMClient = await import("react-dom/client");

    const root = ReactDOMClient.createRoot(qrContainer);

    await new Promise<void>((resolve) => {
      root.render(
        React.createElement(QRCodeSVG, {
          value: qrUrl,
          size: 200,
          bgColor: "#ffffff",
          fgColor: "#000000",
          level: "Q",
          id: qrId,
        }),
      );

      const waitForSVG = () => {
        const svgElement = qrContainer.querySelector("svg");
        if (svgElement) {
          const svgString = new XMLSerializer().serializeToString(svgElement);

          fabric.loadSVGFromString(svgString, (objects, options) => {
            const qrGroup = fabric.util.groupSVGElements(objects, {
              ...options,
              selectable: true,
              hasControls: true,
              dataSourceId: selectedSource,
              fieldPath: selectedField.replace(/\[\d+\]/g, ""),
              itemIndex: itemIndex,
              isDynamic: true,
              qrUrl: qrUrl,
              qrSvgString: svgString,
            });

            qrGroup.scaleToWidth(200);
            qrGroup.scaleToHeight(200);
            editor.canvas.centerObject(qrGroup);
            editor.canvas.add(qrGroup);
            editor.canvas.setActiveObject(qrGroup);
            editor.canvas.renderAll();

            toast({
              title: "Success",
              description: `QR code added to canvas.`,
            });

            onChangeActiveTool("select");

            root.unmount();
            document.body.removeChild(qrContainer);
            resolve();
          });
        } else {
          setTimeout(waitForSVG, 10);
        }
      };

      waitForSVG();
    });
  };

  const buildFieldTree = (data: any, basePath = ""): FieldNode[] => {
    if (data === null || data === undefined) {
      return [];
    }

    if (
      basePath === "" &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      data.data
    ) {
      return buildFieldTree(data.data, "");
    }

    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
        return buildFieldTree(data[0], basePath);
      } else {
        return [
          {
            path: basePath,
            label: formatFieldName(basePath.split(".").pop() || "list"),
            type: "list",
            value: JSON.stringify(data),
          },
        ];
      }
    }

    if (typeof data === "object") {
      return Object.entries(data).map(([key, value]) => {
        const path = basePath ? `${basePath}.${key}` : key;
        const valueType = typeof value;

        if (value === null || value === undefined) {
          return {
            path,
            label: formatFieldName(key),
            type: "empty",
            value: "empty",
          };
        }

        if (Array.isArray(value)) {
          return {
            path,
            label: formatFieldName(key),
            type: "list",
            children: buildFieldTree(value, path),
            isExpanded: expandedNodes.has(path),
          };
        }

        if (valueType === "object") {
          return {
            path,
            label: formatFieldName(key),
            type: "group",
            children: buildFieldTree(value, path),
            isExpanded: expandedNodes.has(path),
          };
        }

        return {
          path,
          label: formatFieldName(key),
          type: valueType,
          value: String(value),
        };
      });
    }

    return [
      {
        path: basePath,
        label: formatFieldName(basePath),
        type: typeof data,
        value: String(data),
      },
    ];
  };

  const renderFieldNode = (node: FieldNode) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.path);
    const isSelected = selectedField === node.path;

    return (
      <div key={node.path} className="mb-1 rounded-lg border">
        <div
          className={cn(
            "flex cursor-pointer items-center rounded-md px-1 py-2 transition-colors hover:bg-muted",
            isSelected && "bg-accent font-medium",
          )}
          onClick={() => {
            setSelectedField(node.path);
            setItemIndex(0);
          }}
        >
          <div className="w-6">
            {hasChildren && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedNodes((prev) => {
                    const newSet = new Set(prev);
                    if (newSet.has(node.path)) {
                      newSet.delete(node.path);
                    } else {
                      newSet.add(node.path);
                    }
                    return newSet;
                  });
                }}
                className="h-5 w-5"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          <div className="flex flex-col space-y-2">
            <span className="font-medium">{node.label}</span>
            <span className="text-sm text-muted-foreground">
              {hasChildren ? `(${node.type})` : node.value || node.type}
            </span>
            <div className="flex-1 overflow-hidden"></div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-4 border-l pl-2">
            {node.children!.map((childNode) => renderFieldNode(childNode))}
          </div>
        )}
      </div>
    );
  };

  const handleSourceSelect = (sourceId: string) => {
    setSelectedSource(sourceId);
    setSelectedField("");
    setItemIndex(0);

    if (dataSources[sourceId]) {
      const tree = buildFieldTree(dataSources[sourceId].data);
      setFieldTree(tree);
      const firstLevelPaths = tree.map((node) => node.path);
      setExpandedNodes(new Set(firstLevelPaths));
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  const getArrayItemCount = () => {
    if (!selectedSource || !selectedField) return 0;

    const data = dataSources[selectedSource]?.data;
    if (!data) return 0;

    const pathParts = selectedField.split(/\.|\[|\]/).filter(Boolean);
    let current = data;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (part === "0" && Array.isArray(current)) {
        return current.length;
      }
      current = current[part];
      if (Array.isArray(current)) {
        return current.length;
      }
      if (!current) break;
    }

    return 0;
  };

  const onClose = () => {
    onChangeActiveTool("select");
  };

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-80 flex-col border-r bg-background shadow-sm",
        activeTool === "dynamic-text" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="Dynamic Content"
        description="Add dynamic text or QR codes from your data"
      />
      <ScrollArea className="flex-1">
        <div className="max-w-80 space-y-6 p-4">
          {Object.keys(dataSources).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center pt-6">
                <Database className="mb-4 h-10 w-10 text-muted-foreground" />
                <CardTitle className="text-lg">No Data Sources</CardTitle>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Connect a data source to create dynamic content
                </p>
                <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Data Source
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Button className="w-full" onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Connect Data Source
              </Button>
              <div className="space-y-2">
                <Label htmlFor="select-source">Choose Data Source</Label>
                <Select
                  value={selectedSource || ""}
                  onValueChange={handleSourceSelect}
                >
                  <SelectTrigger id="select-source">
                    <SelectValue placeholder="Select your data source" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(dataSources).map((sourceId) => (
                      <SelectItem key={sourceId} value={sourceId}>
                        {formatFieldName(sourceId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedSource && (
                <>
                  <Card>
                    <CardContent className="pt-4 text-sm text-muted-foreground">
                      <div>
                        Last Updated:{" "}
                        {formatTimestamp(dataSources[selectedSource].timestamp)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Available Fields
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefreshSource(selectedSource)}
                        disabled={isLoading}
                      >
                        <RefreshCw
                          className={cn(
                            "mr-2 h-3 w-3",
                            isLoading && "animate-spin",
                          )}
                        />
                        Refresh
                      </Button>
                    </CardHeader>
                    {/* <CardContent> */}
                    <div className="max-h-60 overflow-y-auto rounded-md p-2">
                      {fieldTree.map((node) => renderFieldNode(node))}
                    </div>
                    {/* </CardContent> */}
                  </Card>
                  {selectedField && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">
                          Add Content
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {formatFieldName(selectedSource)} →{" "}
                          {formatFieldName(
                            selectedField.split(".").pop() || selectedField,
                          )}
                        </p>
                      </CardHeader>
                      <CardContent>
                        {getArrayItemCount() > 0 && (
                          <div className="mb-4 space-y-2">
                            <Label htmlFor="item-index">Item Number</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="item-index"
                                type="number"
                                min="0"
                                max={getArrayItemCount() - 1}
                                value={itemIndex}
                                onChange={(e) =>
                                  setItemIndex(
                                    Number.parseInt(e.target.value) || 0,
                                  )
                                }
                                className="w-20"
                              />
                              <span className="text-xs text-muted-foreground">
                                of {getArrayItemCount()}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Button
                            className="w-full"
                            onClick={handleAddDynamicText}
                            disabled={isLoading}
                          >
                            Add Text
                          </Button>
                          <Button
                            className="w-full"
                            onClick={handleAddQRCode}
                            disabled={isLoading}
                          >
                            Add QR Code
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      <ToolSidebarClose onClick={onClose} />
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Data Source</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => setShowAddDialog(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <form onSubmit={handleAddSource} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-id">Data Source Name</Label>
              <Input
                id="source-id"
                value={newSourceId}
                onChange={(e) => setNewSourceId(e.target.value)}
                placeholder="e.g., Customer List"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-url">API URL</Label>
              <Input
                id="source-url"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder="e.g., https://api.example.com/users"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-method">Request Method</Label>
              <Select
                value={newSourceMethod}
                onValueChange={setNewSourceMethod}
                disabled={isLoading}
              >
                <SelectTrigger id="source-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-headers">Headers (JSON format)</Label>
              <Textarea
                id="source-headers"
                value={newSourceHeaders}
                onChange={(e) => setNewSourceHeaders(e.target.value)}
                placeholder='{"Authorization": "Bearer your-token"}'
                rows={4}
                disabled={isLoading}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Connecting..." : "Connect"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  );
};
