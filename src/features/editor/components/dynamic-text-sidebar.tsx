"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { ActiveTool } from "@/features/editor/types";
import { useEditor } from "@/features/editor/hooks/use-editor";

type FieldNode = {
  path: string;
  label: string;
  type: string;
  children?: FieldNode[];
  value?: any;
  isExpanded?: boolean;
};

interface DynamicTextSidebarProps {
  editor: any;
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
      const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");
      const parts = normalizedPath.split(".");
      let current = obj;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (Array.isArray(current) && !isNaN(Number(part))) {
          current = current[Number(part)];
        } else if (Array.isArray(current)) {
          current = current[index]?.[part];
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

    const text = new editor.canvas.fabric.Textbox(value, {
      left: 100,
      top: 100,
      width: 200,
      fontSize: 20,
      fontFamily: "Arial",
      fill: "#000000",
      dataSourceId: selectedSource,
      fieldPath: selectedField,
      itemIndex,
      isDynamic: true,
    });

    editor.canvas.add(text);
    editor.canvas.setActiveObject(text);
    editor.canvas.renderAll();

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
      <div key={node.path} style={{ marginBottom: "4px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "4px",
            cursor: "pointer",
            backgroundColor: isSelected ? "#f0f0f0" : "transparent",
            borderRadius: "4px",
          }}
          onClick={() => {
            setSelectedField(node.path);
            setItemIndex(0);
          }}
        >
          <div style={{ width: "16px" }}>
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
                style={{
                  background: "none",
                  border: "none",
                  padding: "0",
                  cursor: "pointer",
                }}
              >
                {isExpanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
              </button>
            )}
          </div>
          <div
            style={{
              marginLeft: "4px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontWeight: "500" }}>{node.label}:</span>{" "}
            {!hasChildren && (
              <span style={{ color: "#666" }}>{node.value || node.type}</span>
            )}
            {hasChildren && <span style={{ color: "#666" }}>{node.type}</span>}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div
            style={{
              marginLeft: "16px",
              borderLeft: "1px solid #ddd",
              paddingLeft: "8px",
            }}
          >
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

  return (
    <aside
      className={`fixed z-20 flex h-full w-[360px] flex-col border-r bg-white ${
        activeTool === "dynamic-text"
          ? "left-[100px] translate-x-0"
          : "-translate-x-full"
      }`}
    >
      <div className="p-6">
        <h3 className="text-lg font-semibold">Dynamic Text</h3>
        {Object.keys(dataSources).length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
            <Database className="mb-2 h-8 w-8 text-gray-400" />
            <h4 className="mb-1 text-sm font-medium">No data sources</h4>
            <p className="text-xs text-gray-500">
              Add a data source to create dynamic content
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <button
              onClick={() => setShowAddDialog(true)}
              className="mb-4 flex items-center rounded-md bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Data Source
            </button>
            <div className="mb-4">
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
                className="w-full rounded-md border border-gray-300 p-2 text-sm"
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
                <div className="mb-4 text-xs text-gray-500">
                  <div>Endpoint: {dataSources[selectedSource].endpoint}</div>
                  <div>
                    Updated:{" "}
                    {formatTimestamp(dataSources[selectedSource].timestamp)}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="mb-2 flex justify-between">
                    <span className="text-sm font-medium">Fields</span>
                    <button
                      onClick={() => handleRefreshSource(selectedSource)}
                      className="flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Refresh
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-md border p-2">
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
                      <div className="mb-2">
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
                              setItemIndex(Number.parseInt(e.target.value) || 0)
                            }
                            className="w-20 rounded-md border border-gray-300 p-1 text-sm"
                          />
                          <span className="text-xs text-gray-500">
                            of {getArrayItemCount() - 1}
                          </span>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={handleAddDynamicText}
                      className="w-full rounded-md bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
                    >
                      Add to Canvas
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
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
                  className="w-full rounded-md border border-gray-300 p-2 text-sm"
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
                  className="w-full rounded-md border border-gray-300 p-2 text-sm"
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
                  className="w-full rounded-md border border-gray-300 p-2 text-sm"
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
                  className="w-full rounded-md border border-gray-300 p-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDialog(false)}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
                >
                  Add Data Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
