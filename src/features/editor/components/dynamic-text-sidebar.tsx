"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [dataSources, setDataSources] = useState<
    Record<string, { endpoint: string; data: any; timestamp: string }>
  >({});
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

  // Open dialog automatically if no data sources
  useEffect(() => {
    if (
      Object.keys(dataSources).length === 0 &&
      activeTool === "dynamic-text"
    ) {
      setShowAddDialog(true);
    }
  }, [dataSources, activeTool]);

  // Add a new data source
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceId || !newSourceUrl) return;

    try {
      let headers = {};
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

      setDataSources((prev) => ({
        ...prev,
        [newSourceId]: {
          endpoint: newSourceUrl,
          method: newSourceMethod,
          headers,
          data,
          timestamp: new Date().toISOString(),
        },
      }));

      setNewSourceId("");
      setNewSourceUrl("");
      setNewSourceMethod("GET");
      setNewSourceHeaders("");
      setShowAddDialog(false);
    } catch (error) {
      console.error("Error adding data source:", error);
      alert(`Failed to fetch data from ${newSourceUrl}`);
    }
  };

  // Refresh a data source
  const handleRefreshSource = async (sourceId: string) => {
    const source = dataSources[sourceId];
    if (!source) return;

    try {
      const response = await fetch(source.endpoint, {
        method: source.method || "GET",
        headers: source.headers || {},
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      setDataSources((prev) => ({
        ...prev,
        [sourceId]: {
          ...prev[sourceId],
          data,
          timestamp: new Date().toISOString(),
        },
      }));
    } catch (error) {
      console.error("Error refreshing data source:", error);
      alert(`Failed to refresh data from ${source.endpoint}`);
    }
  };

  // Add dynamic text to canvas
  const handleAddDynamicText = () => {
    if (!editor || !selectedSource || !selectedField) return;

    const data = dataSources[selectedSource]?.data;
    if (!data) return;

    const getValueByPath = (obj: any, path: string, index: number) => {
      let current = obj;
      const parts = path.split(/[.[]/).map((part) => part.replace(/\]$/, ""));
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === "") continue;
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

    const value = getValueByPath(data, selectedField, itemIndex);

    editor.addText(value, {
      fontSize: 20,
      fontFamily: "Arial",
      fill: "#000000",
      dataSourceId: selectedSource,
      fieldPath: selectedField,
      itemIndex,
      isDynamic: true,
    });

    onChangeActiveTool("select");
  };

  // Build field tree from data
  const buildFieldTree = (data: any, basePath = ""): FieldNode[] => {
    if (data === null || data === undefined) {
      return [];
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return [
          {
            path: basePath,
            label: basePath.split(".").pop() || "array",
            type: "array",
            children: [],
            value: "[]",
          },
        ];
      }

      if (typeof data[0] !== "object" || data[0] === null) {
        return [
          {
            path: basePath,
            label: basePath.split(".").pop() || "array",
            type: "array",
            value: JSON.stringify(data),
          },
        ];
      }

      const arrayNode: FieldNode = {
        path: basePath,
        label: basePath.split(".").pop() || "array",
        type: "array",
        children: [],
      };

      const sampleItemPath = basePath ? `${basePath}[0]` : "[0]";
      arrayNode.children = buildFieldTree(data[0], sampleItemPath);

      return [arrayNode];
    }

    if (typeof data === "object") {
      return Object.entries(data).map(([key, value]) => {
        const path = basePath ? `${basePath}.${key}` : key;
        const valueType = typeof value;

        if (value === null || value === undefined) {
          return {
            path,
            label: key,
            type: "null",
            value: "null",
          };
        }

        if (Array.isArray(value)) {
          return {
            path,
            label: key,
            type: "array",
            children: buildFieldTree(value, path),
            isExpanded: expandedNodes.has(path),
          };
        }

        if (valueType === "object") {
          return {
            path,
            label: key,
            type: "object",
            children: buildFieldTree(value, path),
            isExpanded: expandedNodes.has(path),
          };
        }

        return {
          path,
          label: key,
          type: valueType,
          value: String(value),
        };
      });
    }

    return [
      {
        path: basePath,
        label: basePath,
        type: typeof data,
        value: String(data),
      },
    ];
  };

  // Render a field node
  const renderFieldNode = (node: FieldNode) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.path);
    const isSelected = selectedField === node.path;

    return (
      <div key={node.path} className="mb-1">
        <div
          className={cn(
            "flex cursor-pointer items-center rounded-sm p-2 hover:bg-gray-100",
            isSelected && "bg-gray-100 font-medium",
          )}
          onClick={() => {
            setSelectedField(node.path);
            setItemIndex(0);
          }}
        >
          <div className="w-4">
            {hasChildren && (
              <button
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
                className="flex h-4 w-4 items-center justify-center"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
          <div className="ml-1 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="mr-1 font-medium">{node.label}:</span>
            {!hasChildren && (
              <span className="text-gray-500">{node.value || node.type}</span>
            )}
            {hasChildren && <span className="text-gray-500">{node.type}</span>}
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

  // Update field tree when source changes
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

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  // Get array item count for the selected field
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
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-white",
        activeTool === "dynamic-text" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="Dynamic Text"
        description="Add dynamic text from API data"
      />
      <ScrollArea>
        <div className="space-y-6 p-4">
          {Object.keys(dataSources).length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
              <Database className="mb-2 h-8 w-8 text-gray-400" />
              <h4 className="mb-1 text-sm font-medium">No data sources</h4>
              <p className="text-xs text-gray-500">
                Add a data source to create dynamic content
              </p>
            </div>
          ) : (
            <>
              <Button className="" onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Data Source
              </Button>
              <div>
                <label
                  htmlFor="select-source"
                  className="mb-1 block text-sm font-medium"
                >
                  Select Data Source
                </label>
                <select
                  id="select-source"
                  value={selectedSource || ""}
                  onChange={(e) => handleSourceSelect(e.target.value)}
                  className="rounded-md border border-gray-300 p-2 text-sm"
                >
                  <option value="" disabled>
                    Choose a data source
                  </option>
                  {Object.keys(dataSources).map((sourceId) => (
                    <option key={sourceId} value={sourceId}>
                      {sourceId}
                    </option>
                  ))}
                </select>
              </div>
              {selectedSource && (
                <>
                  <div className="text-xs text-gray-500">
                    <div>Endpoint: {dataSources[selectedSource].endpoint}</div>
                    <div>
                      Updated:{" "}
                      {formatTimestamp(dataSources[selectedSource].timestamp)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Fields</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefreshSource(selectedSource)}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Refresh
                      </Button>
                    </div>
                    <div className="max-h-60 max-w-[300px] overflow-auto rounded-md border p-2">
                      {fieldTree.map((node) => renderFieldNode(node))}
                    </div>
                  </div>
                  {selectedField && (
                    <div className="rounded-md border p-4">
                      <h4 className="mb-2 text-sm font-medium">
                        Add Dynamic Text
                      </h4>
                      <p className="mb-2 text-xs text-gray-500">
                        {selectedSource} → {selectedField}
                      </p>
                      {getArrayItemCount() > 0 && (
                        <div className="mb-4">
                          <label
                            htmlFor="item-index"
                            className="mb-1 block text-xs font-medium"
                          >
                            Item Index
                          </label>
                          <div className="flex items-center gap-2">
                            <input
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
                              className="w-20 rounded-md border border-gray-300 p-1 text-sm"
                            />
                            <span className="text-xs text-gray-500">
                              of {getArrayItemCount() - 1}
                            </span>
                          </div>
                        </div>
                      )}
                      <Button className="" onClick={handleAddDynamicText}>
                        Add to Canvas
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      <ToolSidebarClose onClick={onClose} />
      {showAddDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-96 rounded-md bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Add Data Source</h3>
            <form onSubmit={handleAddSource}>
              <div className="mb-4">
                <label
                  htmlFor="source-id"
                  className="mb-1 block text-sm font-medium"
                >
                  Source ID
                </label>
                <input
                  id="source-id"
                  value={newSourceId}
                  onChange={(e) => setNewSourceId(e.target.value)}
                  placeholder="products"
                  className="rounded-md border border-gray-300 p-2 text-sm"
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="source-url"
                  className="mb-1 block text-sm font-medium"
                >
                  API URL
                </label>
                <input
                  id="source-url"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="https://api.example.com/data"
                  className="rounded-md border border-gray-300 p-2 text-sm"
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="source-method"
                  className="mb-1 block text-sm font-medium"
                >
                  Method
                </label>
                <select
                  id="source-method"
                  value={newSourceMethod}
                  onChange={(e) => setNewSourceMethod(e.target.value)}
                  className="rounded-md border border-gray-300 p-2 text-sm"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
              <div className="mb-4">
                <label
                  htmlFor="source-headers"
                  className="mb-1 block text-sm font-medium"
                >
                  Headers (JSON)
                </label>
                <input
                  id="source-headers"
                  value={newSourceHeaders}
                  onChange={(e) => setNewSourceHeaders(e.target.value)}
                  placeholder='{"Authorization": "Bearer token"}'
                  className="rounded-md border border-gray-300 p-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Add Data Source</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
