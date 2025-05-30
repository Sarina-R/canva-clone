import { fabric } from "fabric";
import React, { useCallback, useState, useMemo, useRef } from "react";

import {
  Editor,
  FILL_COLOR,
  STROKE_WIDTH,
  STROKE_COLOR,
  CIRCLE_OPTIONS,
  DIAMOND_OPTIONS,
  TRIANGLE_OPTIONS,
  BuildEditorProps,
  RECTANGLE_OPTIONS,
  EditorHookProps,
  STROKE_DASH_ARRAY,
  TEXT_OPTIONS,
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE,
  JSON_KEYS,
} from "@/features/editor/types";
import { useHistory } from "@/features/editor/hooks/use-history";
import {
  createFilter,
  downloadFile,
  isTextType,
  transformText,
} from "@/features/editor/utils";
import { useHotkeys } from "@/features/editor/hooks/use-hotkeys";
import { useClipboard } from "@/features/editor/hooks//use-clipboard";
import { useAutoResize } from "@/features/editor/hooks/use-auto-resize";
import { useCanvasEvents } from "@/features/editor/hooks/use-canvas-events";
import { useWindowEvents } from "@/features/editor/hooks/use-window-events";
import { useLoadState } from "@/features/editor/hooks/use-load-state";
import jsPDF from "jspdf";

const buildEditor = ({
  save,
  undo,
  redo,
  canRedo,
  canUndo,
  autoZoom,
  copy,
  paste,
  canvas,
  fillColor,
  fontFamily,
  setFontFamily,
  setFillColor,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  selectedObjects,
  strokeDashArray,
  setStrokeDashArray,
  workspaceDimensions,
  setWorkspaceDimensions,
}: BuildEditorProps): Editor => {
  const initializeCanvas = () => {
    const savedState = localStorage.getItem("canvasState");
    if (savedState) {
      try {
        console.log("🎉 Restoring canvas state from localStorage");
        loadJson(savedState);
      } catch (error) {
        console.error("❌ Failed to restore canvas state:", error);
      }
    }
  };

  initializeCanvas();

  const generateSaveOptions = () => {
    const workspace = getWorkspace() as fabric.Rect;
    const width =
      workspace?.width && workspace.width > 0
        ? workspace.width
        : workspaceDimensions.width || 1200;
    const height =
      workspace?.height && workspace.height > 0
        ? workspace.height
        : workspaceDimensions.height || 900;
    const left = workspace?.left || 0;
    const top = workspace?.top || 0;

    console.log("generateSaveOptions dimensions:", width, height, left, top);

    return {
      name: "Image",
      format: "png",
      quality: 1,
      width,
      height,
      left,
      top,
    };
  };

  const addQRCode = (
    url: string,
    dataSourceId: string,
    fieldPath: string,
    itemIndex: number,
  ) => {
    let current = url;
    if (dataSourceId && fieldPath) {
      const cleanPath = fieldPath.replace(/\[\d+\]/g, "");
      const parts = cleanPath.split(".").filter((part) => part !== "");

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current) {
          current = "N/A";
          break;
        }
        if (Array.isArray(current)) {
          current = current[itemIndex]?.[part];
        } else {
          current = current[part as any];
        }
      }
    }

    const qrElement = document.querySelector(
      `#qr-${dataSourceId}-${fieldPath}-${itemIndex}`,
    );
    if (!qrElement) {
      console.error("QR code element not found");
      return;
    }

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg">${qrElement.outerHTML}</svg>`;

    fabric.loadSVGFromString(svgString, (objects, options) => {
      const qrGroup = fabric.util.groupSVGElements(objects, {
        ...options,
        selectable: true,
        hasControls: true,
        dataSourceId,
        fieldPath,
        itemIndex,
        isDynamic: true,
        qrUrl: current,
        qrSvgString: qrElement.outerHTML, // Store the SVG string
      });

      qrGroup.scaleToWidth(200);
      qrGroup.scaleToHeight(200);
      center(qrGroup);
      canvas.add(qrGroup);
      canvas.setActiveObject(qrGroup);
      canvas.renderAll();

      if (dataSourceId && fieldPath) {
        console.log(`
        🎉 DYNAMIC QR CODE CREATED! 🎉
        ╔══════════════════════════════════╗
        ║  Field: ${fieldPath}             ║
        ║  Source: ${dataSourceId}         ║
        ║  Initial Value: ${current}       ║
        ╚══════════════════════════════════╝
        `);
      }
    });
  };

  const savePdf = () => {
    const options = generateSaveOptions();
    const { width, height, left, top } = options;

    const tempWidth = workspaceDimensions.width;
    const tempHeight = workspaceDimensions.height;

    const pdfWidth = width > 0 ? width : workspaceDimensions.width || 1200;
    const pdfHeight = height > 0 ? height : workspaceDimensions.height || 900;
    console.log(pdfWidth, pdfWidth);
    console.log(workspaceDimensions.width, workspaceDimensions.height);
    const pdfLeft = left || 0;
    const pdfTop = top || 0;

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();

    const workspace = getWorkspace() as fabric.Rect;
    console.log(workspace);

    workspace.set({ visible: false });
    console.log(workspaceDimensions.width, workspaceDimensions.height);

    const imgData = canvas.toDataURL({
      format: "png",
      quality: 1,
      left: pdfLeft,
      top: pdfTop,
      width: pdfWidth,
      height: pdfHeight,
    });

    const pdf = new jsPDF({
      orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
      unit: "px",
      format: [pdfWidth, pdfHeight],
    });

    console.log(tempWidth, tempHeight);

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("design.pdf");

    setWorkspaceDimensions({ width: tempWidth, height: tempHeight });

    console.log(tempWidth, tempHeight);
    workspace.set({ visible: true });
    canvas.renderAll();
    autoZoom();
  };

  const savePng = () => {
    const options = generateSaveOptions();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const dataUrl = canvas.toDataURL(options);
    downloadFile(dataUrl, "png");
    autoZoom();
  };

  const saveSvg = () => {
    const options = generateSaveOptions();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const dataUrl = canvas.toDataURL(options);
    downloadFile(dataUrl, "svg");
    autoZoom();
  };

  const saveJpg = () => {
    const options = generateSaveOptions();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const dataUrl = canvas.toDataURL(options);
    downloadFile(dataUrl, "jpg");
    autoZoom();
  };

  const saveJson = async () => {
    const workspace = getWorkspace() as fabric.Rect;
    let dynamicCount = 0;

    const enhancedObjects = await Promise.all(
      canvas.getObjects().map(async (obj) => {
        const jsonObj = obj.toObject(JSON_KEYS);

        if (jsonObj.isDynamic) {
          dynamicCount++;
          if (jsonObj.qrUrl) {
            console.log(
              `🔄 Saving QR code state for: ${jsonObj.fieldPath} - Index: ${jsonObj.itemIndex}`,
            );
          }
        }

        return jsonObj;
      }),
    );

    const data = {
      width: workspace.width,
      height: workspace.height,
      objects: {
        version: "5.2.4",
        objects: enhancedObjects,
      },
      dynamicMetadata: {
        totalDynamicElements: dynamicCount,
        savedAt: new Date().toISOString(),
        magicLevel: dynamicCount > 0 ? "LEGENDARY" : "BASIC",
        teamMessage:
          dynamicCount > 0
            ? "🚀 Your dynamic elements are now immortal!"
            : "💫 Ready for dynamic magic!",
      },
    };

    if (dynamicCount > 0) {
      console.log(`
      🎉 EXPORT COMPLETE! 🎉
      ╔══════════════════════════════════╗
      ║  🪄 ${dynamicCount} Dynamic Elements Saved!  ║
      ║  ✨ Magic Level: LEGENDARY!      ║
      ║  🚀 Your team rocks!             ║
      ╚══════════════════════════════════╝
      `);
    }

    await transformText(data.objects?.objects || []);
    const fileString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, "\t"),
    )}`;
    downloadFile(fileString, "json");

    localStorage.setItem("canvasState", JSON.stringify(data));
  };

  const loadJson = (json: string) => {
    try {
      const data = JSON.parse(json);
      const objectsData = data.objects || data;
      const metadata = data.dynamicMetadata;

      if (metadata) {
        console.log(`
          🎊 WELCOME BACK! 🎊
          ╔══════════════════════════════════╗
          ║  🪄 Restoring ${metadata.totalDynamicElements} Dynamic Elements  ║
          ║  ✨ ${metadata.magicLevel} Magic Detected!     ║
          ║  💫 ${metadata.teamMessage}      ║
          ╚══════════════════════════════════╗
        `);
      }

      if (data.width && data.height) {
        canvas.setWidth(data.width);
        canvas.setHeight(data.height);
        setWorkspaceDimensions({ width: data.width, height: data.height });
      }

      canvas.loadFromJSON(objectsData, async () => {
        let restoredDynamicCount = 0;
        const dynamicObjects = canvas
          .getObjects()
          .filter((obj: any) => obj.get("isDynamic"));

        for (const obj of dynamicObjects) {
          if (obj.get("isDynamic")) {
            restoredDynamicCount++;
            if (obj.get("qrUrl")) {
              const qrUrl = obj.get("qrUrl");
              const dataSourceId = obj.get("dataSourceId");
              const fieldPath = obj.get("fieldPath");
              const itemIndex = obj.get("itemIndex");

              console.log(
                `✅ Dynamic QR code restored: ${fieldPath} - ${qrUrl}`,
              );
            }
          }
        }

        if (restoredDynamicCount > 0) {
          console.log(`
            🎯 RESTORATION COMPLETE! 🎯
            ╔══════════════════════════════════╗
            ║  ✅ ${restoredDynamicCount} Dynamic Elements Active!   ║
            ║  🚀 Ready for export magic!      ║
            ║  💪 Your persistence paid off!   ║
            ╚══════════════════════════════════╝
          `);
        }

        canvas.renderAll();
        autoZoom();
      });
    } catch (error) {
      console.error("❌ JSON loading failed:", error);
      const data = JSON.parse(json);
      canvas.loadFromJSON(data.objects || data, () => autoZoom());
    }
  };

  const getWorkspace = () => {
    return canvas.getObjects().find((object) => object.name === "clip");
  };

  const center = (object: fabric.Object) => {
    const workspace = getWorkspace();
    const center = workspace?.getCenterPoint();
    if (!center) return;
    // @ts-ignore
    canvas._centerObject(object, center);
  };

  const addToCanvas = (object: fabric.Object) => {
    center(object);
    canvas.add(object);
    canvas.setActiveObject(object);
  };

  const updateDynamicText = (
    dataSourceId: string,
    fieldPath: string,
    itemIndex: number,
    sourceData: any,
  ) => {
    let updatedCount = 0;

    canvas.getObjects().forEach((obj: any) => {
      if (obj.get("isDynamic") && obj.get("dataSourceId") === dataSourceId) {
        const objFieldPath = obj.get("fieldPath");
        if (objFieldPath === fieldPath) {
          const cleanPath = fieldPath.replace(/\[\d+\]/g, "");
          let current = sourceData;
          const parts = cleanPath.split(".").filter((part) => part !== "");

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!current) {
              obj.set("text", "N/A");
              return;
            }
            if (Array.isArray(current)) {
              current = current[itemIndex]?.[part];
            } else {
              current = current[part];
            }
          }

          const newText =
            current !== undefined && current !== null
              ? current.toString()
              : "N/A";

          obj.set("text", newText);
          updatedCount++;

          // console.log(`🔄 Updated dynamic text: ${fieldPath} -> "${newText}"`);
        }
      }
    });

    if (updatedCount > 0) {
      // console.log(`✨ Successfully updated ${updatedCount} dynamic elements!`);
    }

    canvas.renderAll();
  };

  const updateDynamicQRCodes = async (
    dataSourceId: string,
    fieldPath: string,
    itemIndex: number,
    sourceData: any,
  ) => {
    let updatedCount = 0;

    const qrObjects = canvas
      .getObjects()
      .filter(
        (obj: any) =>
          obj.get("isDynamic") &&
          obj.get("dataSourceId") === dataSourceId &&
          obj.get("fieldPath") === fieldPath &&
          (obj.get("qrUrl") || obj.get("qrSvgString")),
      );

    for (const obj of qrObjects) {
      const cleanPath = fieldPath.replace(/\[\d+\]/g, "");
      let current = sourceData;
      const parts = cleanPath.split(".").filter((part) => part !== "");

      for (const part of parts) {
        if (!current) break;
        if (Array.isArray(current)) {
          current = current[itemIndex]?.[part];
        } else {
          current = current[part];
        }
      }

      if (!current) continue;

      const newValue = `https://avisengien/${current.toString()}`;

      const tempQrContainer = document.createElement("div");
      tempQrContainer.style.position = "absolute";
      tempQrContainer.style.visibility = "hidden";
      document.body.appendChild(tempQrContainer);

      try {
        const QRCodeSVG = (await import("react-qr-code")).default;
        const ReactDOM = await import("react-dom");

        await new Promise<void>((resolve) => {
          ReactDOM.render(
            React.createElement(QRCodeSVG, {
              value: newValue,
              size: 200,
              bgColor: "#ffffff",
              fgColor: "#000000",
              level: "Q",
            }),
            tempQrContainer,
            async () => {
              const svgElement = tempQrContainer.querySelector("svg");
              if (svgElement) {
                const svgString = new XMLSerializer().serializeToString(
                  svgElement,
                );

                const currentProps = {
                  left: obj.left,
                  top: obj.top,
                  scaleX: obj.scaleX,
                  scaleY: obj.scaleY,
                  angle: obj.angle,
                  dataSourceId,
                  fieldPath,
                  itemIndex,
                  isDynamic: true,
                  qrUrl: newValue,
                  qrSvgString: svgString,
                };

                await new Promise<void>((resolveInner) => {
                  fabric.loadSVGFromString(
                    `<svg xmlns="http://www.w3.org/2000/svg">${svgString}</svg>`,
                    (objects, options) => {
                      const qrGroup = fabric.util.groupSVGElements(objects, {
                        ...options,
                        ...currentProps,
                        selectable: true,
                        hasControls: true,
                      });

                      canvas.remove(obj);
                      canvas.add(qrGroup);
                      canvas.renderAll();
                      updatedCount++;
                      resolveInner();
                    },
                  );
                });
              }
              resolve();
            },
          );
        });
      } finally {
        document.body.removeChild(tempQrContainer);
      }
    }

    if (updatedCount > 0) {
      console.log(
        `✨ Updated ${updatedCount} QR codes for index ${itemIndex} with new data`,
      );
      canvas.renderAll();
    }

    return updatedCount;
  };

  return {
    savePdf,
    savePng,
    saveJpg,
    saveSvg,
    saveJson,
    loadJson,
    canUndo,
    canRedo,
    autoZoom,
    getWorkspace,
    generateSaveOptions,
    addQRCode,
    zoomIn: () => {
      let zoomRatio = canvas.getZoom();
      zoomRatio += 0.05;
      const center = canvas.getCenter();
      canvas.zoomToPoint(
        new fabric.Point(center.left, center.top),
        zoomRatio > 1 ? 1 : zoomRatio,
      );
    },
    zoomOut: () => {
      let zoomRatio = canvas.getZoom();
      zoomRatio -= 0.05;
      const center = canvas.getCenter();
      canvas.zoomToPoint(
        new fabric.Point(center.left, center.top),
        zoomRatio < 0.2 ? 0.2 : zoomRatio,
      );
    },
    changeSize: (value: { width: number; height: number }) => {
      const workspace = getWorkspace();
      workspace?.set(value);
      canvas.setWidth(value.width);
      canvas.setHeight(value.height);
      setWorkspaceDimensions(value);
      autoZoom();
      save();
    },
    changeBackground: (value: string) => {
      const workspace = getWorkspace();
      workspace?.set({ fill: value });
      canvas.renderAll();
      save();
    },
    enableDrawingMode: () => {
      canvas.discardActiveObject();
      canvas.renderAll();
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = strokeWidth;
      canvas.freeDrawingBrush.color = strokeColor;
    },
    disableDrawingMode: () => {
      canvas.isDrawingMode = false;
    },
    onUndo: () => undo(),
    onRedo: () => redo(),
    onCopy: () => copy(),
    onPaste: () => paste(),
    changeImageFilter: (value: string) => {
      const objects = canvas.getActiveObjects();
      objects.forEach((object) => {
        if (object.type === "image") {
          const imageObject = object as fabric.Image;
          const effect = createFilter(value);
          imageObject.filters = effect ? [effect] : [];
          imageObject.applyFilters();
          canvas.renderAll();
        }
      });
    },
    addImage: (value: string) => {
      fabric.Image.fromURL(
        value,
        (image) => {
          const workspace = getWorkspace();
          image.scaleToWidth(workspace?.width || 0);
          image.scaleToHeight(workspace?.height || 0);
          addToCanvas(image);
        },
        {
          crossOrigin: "anonymous",
        },
      );
    },
    delete: () => {
      canvas.getActiveObjects().forEach((object) => canvas.remove(object));
      canvas.discardActiveObject();
      canvas.renderAll();
    },
    addText: (
      value: string,
      options: any,
      isDynamic = false,
      dataSourceId?: string,
      fieldPath?: string,
    ) => {
      const encouragingMessages = [
        "🚀 This text has superpowers!",
        "✨ Dynamic magic activated!",
        "🎯 Data-driven excellence!",
        "💫 Your code is amazing!",
        "🔥 Building the future!",
        "⚡ Innovation in progress!",
        "🌟 Team effort = Success!",
      ];

      const object = new fabric.Textbox(value, {
        ...TEXT_OPTIONS,
        fill: fillColor,
        isDynamic: isDynamic,
        dataSourceId: dataSourceId || null,
        fieldPath: fieldPath || null,
        originalText: value,
        magicSpells: isDynamic
          ? encouragingMessages[
              Math.floor(Math.random() * encouragingMessages.length)
            ]
          : null,
        ...options,
      });

      if (isDynamic) {
        console.log(`
          🎉 DYNAMIC TEXT CREATED! 🎉
          ╔══════════════════════════════════╗
          ║  Field: ${fieldPath}             ║
          ║  Source: ${dataSourceId}         ║
          ║  Magic Level: MAXIMUM! ✨        ║
          ╚══════════════════════════════════╝
          `);
      }

      addToCanvas(object);
      return object;
    },
    updateDynamicText,
    updateDynamicQRCodes,
    getActiveOpacity: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return 1;
      }
      const value = selectedObject.get("opacity") || 1;
      return value;
    },
    changeFontSize: (value: number) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          object.set({ fontSize: value });
        }
      });
      canvas.renderAll();
    },
    getActiveFontSize: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return FONT_SIZE;
      }
      // @ts-ignore
      const value = selectedObject.get("fontSize") || FONT_SIZE;
      return value;
    },
    changeTextAlign: (value: string) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          object.set({ textAlign: value });
        }
      });
      canvas.renderAll();
    },
    getActiveTextAlign: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return "left";
      }
      // @ts-ignore
      const value = selectedObject.get("textAlign") || "left";
      return value;
    },
    changeFontUnderline: (value: boolean) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          object.set({ underline: value });
        }
      });
      canvas.renderAll();
    },
    getActiveFontUnderline: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return false;
      }
      // @ts-ignore
      const value = selectedObject.get("underline") || false;
      return value;
    },
    changeFontLinethrough: (value: boolean) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          object.set({ linethrough: value });
        }
      });
      canvas.renderAll();
    },
    getActiveFontLinethrough: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return false;
      }
      // @ts-ignore
      const value = selectedObject.get("linethrough") || false;
      return value;
    },
    changeFontStyle: (value: string) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          object.set({ fontStyle: value });
        }
      });
      canvas.renderAll();
    },
    getActiveFontStyle: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return "normal";
      }
      // @ts-ignore
      const value = selectedObject.get("fontStyle") || "normal";
      return value;
    },
    changeFontWeight: (value: number) => {
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          object.set({ fontWeight: value });
        }
      });
      canvas.renderAll();
    },
    changeOpacity: (value: number) => {
      canvas.getActiveObjects().forEach((object) => {
        object.set({ opacity: value });
      });
      canvas.renderAll();
    },
    bringForward: () => {
      canvas.getActiveObjects().forEach((object) => {
        canvas.bringForward(object);
      });
      canvas.renderAll();
      const workspace = getWorkspace();
      workspace?.sendToBack();
    },
    sendBackwards: () => {
      canvas.getActiveObjects().forEach((object) => {
        canvas.sendBackwards(object);
      });
      canvas.renderAll();
      const workspace = getWorkspace();
      workspace?.sendToBack();
    },
    changeFontFamily: (value: string) => {
      setFontFamily(value);
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          // @ts-ignore
          object.set({ fontFamily: value });
        }
      });
      canvas.renderAll();
    },
    changeFillColor: (value: string) => {
      setFillColor(value);
      canvas.getActiveObjects().forEach((object) => {
        object.set({ fill: value });
      });
      canvas.renderAll();
    },
    changeStrokeColor: (value: string) => {
      setStrokeColor(value);
      canvas.getActiveObjects().forEach((object) => {
        if (isTextType(object.type)) {
          object.set({ fill: value });
          return;
        }
        object.set({ stroke: value });
      });
      canvas.freeDrawingBrush.color = value;
      canvas.renderAll();
    },
    changeStrokeWidth: (value: number) => {
      setStrokeWidth(value);
      canvas.getActiveObjects().forEach((object) => {
        object.set({ strokeWidth: value });
      });
      canvas.freeDrawingBrush.width = value;
      canvas.renderAll();
    },
    changeStrokeDashArray: (value: number[]) => {
      setStrokeDashArray(value);
      canvas.getActiveObjects().forEach((object) => {
        object.set({ strokeDashArray: value });
      });
      canvas.renderAll();
    },
    addCircle: () => {
      const object = new fabric.Circle({
        ...CIRCLE_OPTIONS,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      });
      addToCanvas(object);
    },
    addSoftRectangle: () => {
      const object = new fabric.Rect({
        ...RECTANGLE_OPTIONS,
        rx: 50,
        ry: 50,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      });
      addToCanvas(object);
    },
    addRectangle: () => {
      const object = new fabric.Rect({
        ...RECTANGLE_OPTIONS,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      });
      addToCanvas(object);
    },
    addTriangle: () => {
      const object = new fabric.Triangle({
        ...TRIANGLE_OPTIONS,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: strokeDashArray,
      });
      addToCanvas(object);
    },
    addInverseTriangle: () => {
      const HEIGHT = TRIANGLE_OPTIONS.height;
      const WIDTH = TRIANGLE_OPTIONS.width;
      const object = new fabric.Polygon(
        [
          { x: 0, y: 0 },
          { x: WIDTH, y: 0 },
          { x: WIDTH / 2, y: HEIGHT },
        ],
        {
          ...TRIANGLE_OPTIONS,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeDashArray: strokeDashArray,
        },
      );
      addToCanvas(object);
    },
    addDiamond: () => {
      const HEIGHT = DIAMOND_OPTIONS.height;
      const WIDTH = DIAMOND_OPTIONS.width;
      const object = new fabric.Polygon(
        [
          { x: WIDTH / 2, y: 0 },
          { x: WIDTH, y: HEIGHT / 2 },
          { x: WIDTH / 2, y: HEIGHT },
          { x: 0, y: HEIGHT / 2 },
        ],
        {
          ...DIAMOND_OPTIONS,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeDashArray: strokeDashArray,
        },
      );
      addToCanvas(object);
    },
    canvas,
    getActiveFontWeight: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return FONT_WEIGHT;
      }
      // @ts-ignore
      const value = selectedObject.get("fontWeight") || FONT_WEIGHT;
      return value;
    },
    getActiveFontFamily: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return fontFamily;
      }
      // @ts-ignore
      const value = selectedObject.get("fontFamily") || fontFamily;
      return value;
    },
    getActiveFillColor: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return fillColor;
      }
      const value = selectedObject.get("fill") || fillColor;
      return value as string;
    },
    getActiveStrokeColor: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return strokeColor;
      }
      const value = selectedObject.get("stroke") || strokeColor;
      return value;
    },
    getActiveStrokeWidth: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return strokeWidth;
      }
      const value = selectedObject.get("strokeWidth") || strokeWidth;
      return value;
    },
    getActiveStrokeDashArray: () => {
      const selectedObject = selectedObjects[0];
      if (!selectedObject) {
        return strokeDashArray;
      }
      const value = selectedObject.get("strokeDashArray") || strokeDashArray;
      return value;
    },
    selectedObjects,
  };
};

export const useEditor = ({
  defaultState,
  defaultHeight,
  defaultWidth,
  clearSelectionCallback,
  saveCallback,
}: EditorHookProps) => {
  const initialState = useRef(defaultState);
  const initialWidth = useRef(defaultWidth);
  const initialHeight = useRef(defaultHeight);

  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<fabric.Object[]>([]);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILY);
  const [fillColor, setFillColor] = useState(FILL_COLOR);
  const [strokeColor, setStrokeColor] = useState(STROKE_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTH);
  const [strokeDashArray, setStrokeDashArray] =
    useState<number[]>(STROKE_DASH_ARRAY);
  const [workspaceDimensions, setWorkspaceDimensions] = useState({
    width: defaultWidth || 1200,
    height: defaultHeight || 900,
  });

  useWindowEvents();

  const { save, canRedo, canUndo, undo, redo, canvasHistory, setHistoryIndex } =
    useHistory({
      canvas,
      saveCallback,
    });

  const { copy, paste } = useClipboard({ canvas });

  const { autoZoom } = useAutoResize({
    canvas,
    container,
  });

  useCanvasEvents({
    save,
    canvas,
    setSelectedObjects,
    clearSelectionCallback,
  });

  useHotkeys({
    undo,
    redo,
    copy,
    paste,
    save,
    canvas,
  });

  useLoadState({
    canvas,
    autoZoom,
    initialState,
    canvasHistory,
    setHistoryIndex,
  });

  const editor = useMemo(() => {
    if (canvas) {
      return buildEditor({
        save,
        undo,
        redo,
        canUndo,
        canRedo,
        autoZoom,
        copy,
        paste,
        canvas,
        fillColor,
        strokeWidth,
        strokeColor,
        setFillColor,
        setStrokeColor,
        setStrokeWidth,
        strokeDashArray,
        selectedObjects,
        setStrokeDashArray,
        fontFamily,
        setFontFamily,
        workspaceDimensions,
        setWorkspaceDimensions,
      });
    }
    return undefined;
  }, [
    canRedo,
    canUndo,
    undo,
    redo,
    save,
    autoZoom,
    copy,
    paste,
    canvas,
    fillColor,
    strokeWidth,
    strokeColor,
    selectedObjects,
    strokeDashArray,
    fontFamily,
    workspaceDimensions,
  ]);

  const init = useCallback(
    ({
      initialCanvas,
      initialContainer,
    }: {
      initialCanvas: fabric.Canvas;
      initialContainer: HTMLDivElement;
    }) => {
      fabric.Object.prototype.set({
        cornerColor: "#FFF",
        cornerStyle: "circle",
        borderColor: "#3b82f6",
        borderScaleFactor: 1.5,
        transparentCorners: false,
        borderOpacityWhenMoving: 1,
        cornerStrokeColor: "#3b82f6",
      });

      const initialWorkspace = new fabric.Rect({
        width: initialWidth.current,
        height: initialHeight.current,
        name: "clip",
        fill: "white",
        selectable: false,
        hasControls: false,
        shadow: new fabric.Shadow({
          color: "rgba(0,0,0,0.8)",
          blur: 5,
        }),
      });

      initialCanvas.setWidth(initialContainer.offsetWidth);
      initialCanvas.setHeight(initialContainer.offsetHeight);

      initialCanvas.add(initialWorkspace);
      initialCanvas.centerObject(initialWorkspace);
      initialCanvas.clipPath = initialWorkspace;

      setCanvas(initialCanvas);
      setContainer(initialContainer);

      const currentState = JSON.stringify(initialCanvas.toJSON(JSON_KEYS));
      canvasHistory.current = [currentState];
      setHistoryIndex(0);
    },
    [canvasHistory, setHistoryIndex],
  );

  return { init, editor };
};
