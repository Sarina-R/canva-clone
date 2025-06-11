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
let backgroundImageObject: fabric.Image | null = null;
let isBackgroundImageLocked = false;
let backgroundImageUrl: string | null = null;
let onBackgroundStateChange: ((state: any) => void) | null = null;

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
  const getWorkspace = () => {
    return canvas.getObjects().find((object) => object.name === "clip");
  };

  const syncBackgroundState = () => {
    if (onBackgroundStateChange) {
      const backgroundInfo = getBackgroundImageInfo();
      onBackgroundStateChange({
        backgroundImage: backgroundImageUrl,
        isBackgroundLocked: isBackgroundImageLocked,
        backgroundImageSize: backgroundInfo
          ? {
              width: backgroundInfo.width || 0,
              height: backgroundInfo.height || 0,
            }
          : { width: 0, height: 0 },
      });
    }
  };

  const initializeCanvas = () => {
    const savedState = localStorage.getItem("canvasState");
    if (savedState) {
      console.log(
        "🎉 Canvas state found in localStorage, will be loaded by component",
      );

      try {
        const data = JSON.parse(savedState);
        const backgroundState = data.backgroundImageState;

        if (backgroundState?.hasBackgroundImage && backgroundState?.imageUrl) {
          backgroundImageUrl = backgroundState.imageUrl;
          isBackgroundImageLocked = backgroundState.isLocked || false;

          console.log("💾 Background state restored from localStorage:", {
            imageUrl: backgroundState.imageUrl,
            isLocked: isBackgroundImageLocked,
          });

          setTimeout(() => {
            syncBackgroundState();
          }, 100);
        }
      } catch (error) {
        console.error("❌ Error parsing saved state:", error);
      }
    } else {
      const workspace = getWorkspace() as fabric.Rect;
      if (workspace) {
        workspace.set({ fill: "#ffffff" });
        canvas.renderAll();
        console.log("✅ Default white background set for workspace");
      }
    }
  };

  initializeCanvas();
  const setBackgroundStateChangeListener = (callback: (state: any) => void) => {
    onBackgroundStateChange = callback;
  };

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
        qrSvgString: qrElement.outerHTML,
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

  const savePdf = (includeBackground = true) => {
    const options = generateSaveOptions();
    const { width, height, left, top } = options;

    const tempWidth = workspaceDimensions.width;
    const tempHeight = workspaceDimensions.height;

    const pdfWidth = width > 0 ? width : workspaceDimensions.width || 1200;
    const pdfHeight = height > 0 ? height : workspaceDimensions.height || 900;
    const pdfLeft = left || 0;
    const pdfTop = top || 0;

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();

    const workspace = getWorkspace() as fabric.Rect;

    let tempBackground: fabric.Image | null = null;

    if (!includeBackground) {
      if (backgroundImageObject) {
        tempBackground = backgroundImageObject;
        canvas.remove(backgroundImageObject);
        canvas.renderAll();
      }
    }

    workspace.set({ visible: false });

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

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("design.pdf");

    if (tempBackground) {
      canvas.add(tempBackground);
      tempBackground.moveTo(1);
      canvas.renderAll();
    }

    workspace.set({ visible: true });
    canvas.renderAll();

    setWorkspaceDimensions({ width: tempWidth, height: tempHeight });
    autoZoom();
  };

  const savePng = (includeBackground = true) => {
    const options = generateSaveOptions();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    let tempBackground: fabric.Image | null = null;
    const backgroundImg = canvas
      .getObjects()
      .find(
        (obj: any) => obj.name === "backgroundImage" || obj.isBackgroundImage,
      ) as fabric.Image;

    if (!includeBackground && backgroundImg) {
      tempBackground = backgroundImg;
      canvas.remove(backgroundImg);
      canvas.renderAll();
    }

    const dataUrl = canvas.toDataURL(options);
    downloadFile(dataUrl, "png");

    if (tempBackground) {
      canvas.add(tempBackground);
      tempBackground.moveTo(1);
      canvas.renderAll();
    }

    autoZoom();
  };

  const saveSvg = (includeBackground = true) => {
    const options = generateSaveOptions();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    let tempBackground: fabric.Image | null = null;
    if (!includeBackground && backgroundImageObject) {
      tempBackground = backgroundImageObject;
      canvas.remove(backgroundImageObject);
      canvas.remove(backgroundImageObject);
      canvas.renderAll();
    }

    const dataUrl = canvas.toSVG(options);
    downloadFile(dataUrl, "svg");

    if (tempBackground) {
      canvas.add(tempBackground);
      tempBackground.moveTo(1);
      canvas.renderAll();
    }

    autoZoom();
  };

  const saveJpg = (includeBackground = true) => {
    const options = generateSaveOptions();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    let tempBackground: fabric.Image | null = null;
    console.log(backgroundImageObject);
    console.log(includeBackground);

    if (!includeBackground && backgroundImageObject) {
      tempBackground = backgroundImageObject;

      canvas.remove(backgroundImageObject);
      canvas.renderAll();
    }

    const dataUrl = canvas.toDataURL({ ...options, format: "jpeg" });
    downloadFile(dataUrl, "jpg");

    if (tempBackground) {
      canvas.add(tempBackground);
      tempBackground.moveTo(1);
      canvas.renderAll();
    }

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

        if (obj === backgroundImageObject) {
          jsonObj.isBackgroundImage = true;
          jsonObj.isLocked = isBackgroundImageLocked;
          jsonObj.imageUrl = backgroundImageUrl;
          jsonObj.name = "backgroundImage";
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
      backgroundImageState: {
        hasBackgroundImage: !!backgroundImageObject,
        isLocked: isBackgroundImageLocked,
        imageUrl: backgroundImageUrl,
        dimensions: backgroundImageObject
          ? {
              width: backgroundImageObject.width,
              height: backgroundImageObject.height,
              scaleX: backgroundImageObject.scaleX,
              scaleY: backgroundImageObject.scaleY,
              left: backgroundImageObject.left,
              top: backgroundImageObject.top,
            }
          : null,
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

    console.log("💾 Saving background state:", data.backgroundImageState);

    await transformText(data.objects?.objects || []);
    const fileString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, "\t"),
    )}`;
    downloadFile(fileString, "json");

    localStorage.setItem("canvasState", JSON.stringify(data));
    console.log("✅ Canvas state saved to localStorage with background:", {
      hasBackground: !!backgroundImageObject,
      imageUrl: backgroundImageUrl,
      isLocked: isBackgroundImageLocked,
    });
  };

  const loadJson = (json: string) => {
    try {
      const data = JSON.parse(json);
      const objectsData = data.objects || data;
      const backgroundState = data.backgroundImageState;

      console.log("📂 Loading canvas state with background:", backgroundState);

      if (data.width && data.height) {
        canvas.setWidth(data.width);
        canvas.setHeight(data.height);
        setWorkspaceDimensions({ width: data.width, height: data.height });
      }

      canvas.loadFromJSON(objectsData, () => {
        if (
          backgroundState &&
          backgroundState.hasBackgroundImage &&
          backgroundState.imageUrl
        ) {
          console.log(
            "🖼️ Restoring background image from backgroundState:",
            backgroundState.imageUrl,
          );

          backgroundImageUrl = backgroundState.imageUrl;
          isBackgroundImageLocked = backgroundState.isLocked || false;

          fabric.Image.fromURL(
            backgroundState.imageUrl,
            (img) => {
              const workspace = getWorkspace();
              if (!workspace) return;

              if (backgroundState.dimensions) {
                img.set({
                  scaleX: backgroundState.dimensions.scaleX || 1,
                  scaleY: backgroundState.dimensions.scaleY || 1,
                  left: backgroundState.dimensions.left || workspace.left || 0,
                  top: backgroundState.dimensions.top || workspace.top || 0,
                });
              } else {
                const workspaceWidth = workspace.width || 900;
                const workspaceHeight = workspace.height || 1200;

                img.scaleToWidth(workspaceWidth);
                if (img.getScaledHeight() > workspaceHeight) {
                  img.scaleToHeight(workspaceHeight);
                }

                img.set({
                  left: workspace.left || 0,
                  top: workspace.top || 0,
                });
              }

              img.set({
                selectable: !isBackgroundImageLocked,
                evented: !isBackgroundImageLocked,
                hasControls: !isBackgroundImageLocked,
                hasBorders: !isBackgroundImageLocked,
                lockMovementX: isBackgroundImageLocked,
                lockMovementY: isBackgroundImageLocked,
                lockScalingX: isBackgroundImageLocked,
                lockScalingY: isBackgroundImageLocked,
                lockRotation: isBackgroundImageLocked,
                name: "backgroundImage",
                // @ts-ignore
                isBackgroundImage: true,
                isLocked: isBackgroundImageLocked,
                excludeFromExport: false,
                imageUrl: backgroundState.imageUrl,
                data: {
                  isBackgroundImage: true,
                  imageUrl: backgroundState.imageUrl,
                },
              });

              canvas.add(img);
              img.moveTo(1);
              backgroundImageObject = img;

              canvas.renderAll();

              setTimeout(() => {
                syncBackgroundState();
                console.log(
                  `✅ Background image restored and synced (${isBackgroundImageLocked ? "locked" : "unlocked"})`,
                );
              }, 100);
            },
            {
              crossOrigin: "anonymous",
            },
          );
        } else {
          backgroundImageObject = null;
          isBackgroundImageLocked = false;
          backgroundImageUrl = null;

          setTimeout(() => {
            syncBackgroundState();
          }, 100);
        }

        canvas.renderAll();
        autoZoom();
      });
    } catch (error) {
      console.error("❌ JSON loading failed:", error);
      const data = JSON.parse(json);
      canvas.loadFromJSON(data.objects || data, () => {
        autoZoom();
        setTimeout(() => {
          syncBackgroundState();
        }, 100);
      });
    }
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
        const ReactDOMClient = await import("react-dom/client");

        await new Promise<void>(async (resolve) => {
          const root = ReactDOMClient.createRoot(tempQrContainer);

          root.render(
            React.createElement(QRCodeSVG, {
              value: newValue,
              size: 200,
              bgColor: "#ffffff",
              fgColor: "#000000",
              level: "Q",
            }),
          );

          // ✅ Wait until the SVG is actually rendered
          const svgElement = await new Promise<SVGSVGElement | null>(
            (resolveSvg) => {
              const maxWait = 500;
              const interval = 10;
              let waited = 0;

              const check = () => {
                const svg = tempQrContainer.querySelector("svg");
                if (svg) {
                  resolveSvg(svg as SVGSVGElement);
                } else if (waited >= maxWait) {
                  resolveSvg(null);
                } else {
                  waited += interval;
                  setTimeout(check, interval);
                }
              };

              check();
            },
          );

          if (svgElement) {
            const svgString = new XMLSerializer().serializeToString(svgElement);

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

          root.unmount();
          resolve();
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

  const setBackgroundImage = (imageUrl: string, locked = false) => {
    if (backgroundImageObject) {
      canvas.remove(backgroundImageObject);
      backgroundImageObject = null;
    }

    backgroundImageUrl = imageUrl;

    fabric.Image.fromURL(
      imageUrl,
      (img) => {
        const workspace = getWorkspace();
        if (!workspace) return;

        const workspaceWidth = workspace.width || 900;
        const workspaceHeight = workspace.height || 1200;

        img.scaleToWidth(workspaceWidth);
        if (img.getScaledHeight() > workspaceHeight) {
          img.scaleToHeight(workspaceHeight);
        }

        img.set({
          left: workspace.left || 0,
          top: workspace.top || 0,
          selectable: !locked,
          evented: !locked,
          hasControls: !locked,
          hasBorders: !locked,
          lockMovementX: locked,
          lockMovementY: locked,
          lockScalingX: locked,
          lockScalingY: locked,
          lockRotation: locked,
          name: "backgroundImage",
          // @ts-ignore
          isBackgroundImage: true,
          isLocked: locked,
          imageUrl: imageUrl,
          data: {
            isBackgroundImage: true,
            imageUrl: imageUrl,
          },
          excludeFromExport: false,
        });

        canvas.add(img);
        img.moveTo(1);
        backgroundImageObject = img;
        isBackgroundImageLocked = locked;

        canvas.renderAll();
        save();

        syncBackgroundState();

        console.log(
          `✅ Background image set and synced (${locked ? "locked" : "unlocked"})`,
        );
      },
      {
        crossOrigin: "anonymous",
      },
    );
  };

  const setBackgroundImageLock = (locked: boolean) => {
    if (!backgroundImageObject) return;

    isBackgroundImageLocked = locked;
    backgroundImageObject.set({
      selectable: !locked,
      evented: !locked,
      hasControls: !locked,
      hasBorders: !locked,
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      // @ts-ignore
      isLocked: locked,
    });

    if (locked && canvas.getActiveObject() === backgroundImageObject) {
      canvas.discardActiveObject();
    }

    backgroundImageObject.moveTo(1);
    canvas.renderAll();
    save();

    syncBackgroundState();
  };

  const removeBackgroundImage = () => {
    if (backgroundImageObject) {
      canvas.remove(backgroundImageObject);
      backgroundImageObject = null;
      isBackgroundImageLocked = false;
      backgroundImageUrl = null;
      canvas.renderAll();
      save();

      syncBackgroundState();

      console.log("✅ Background image removed and synced");
    }
  };

  const getBackgroundImageInfo = () => {
    if (!backgroundImageObject || !backgroundImageUrl) return null;

    return {
      isLocked: isBackgroundImageLocked,
      width: backgroundImageObject.width,
      height: backgroundImageObject.height,
      scaleX: backgroundImageObject.scaleX,
      scaleY: backgroundImageObject.scaleY,
      imageUrl: backgroundImageUrl,
    };
  };

  const changeSize = (value: { width: number; height: number }) => {
    const workspace = getWorkspace();
    workspace?.set(value);
    canvas.setWidth(value.width);
    canvas.setHeight(value.height);
    setWorkspaceDimensions(value);

    if (backgroundImageObject) {
      const img = backgroundImageObject;

      const originalWidth = img.width || 1;
      const originalHeight = img.height || 1;

      const scaleX = value.width / originalWidth;
      const scaleY = value.height / originalHeight;
      const scale = Math.min(scaleX, scaleY);

      img.set({
        scaleX: scale,
        scaleY: scale,
        left: workspace?.left || 0,
        top: workspace?.top || 0,
      });

      img.moveTo(1);
    }

    autoZoom();
    save();
  };

  canvas.on("object:modified", (e) => {
    if (
      e.target &&
      // @ts-ignore
      (e.target.name === "backgroundImage" || e.target.isBackgroundImage)
    ) {
      console.log("🔄 Background object modified, syncing state...");
      setTimeout(() => {
        syncBackgroundState();
      }, 50);
    }
  });

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
    setBackgroundImage,
    setBackgroundImageLock,
    removeBackgroundImage,
    changeSize,
    getBackgroundImageInfo,
    setBackgroundStateChangeListener,
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
      const activeObjects = canvas.getActiveObjects();
      const objectsToDelete = activeObjects.filter((obj) => {
        if (obj === backgroundImageObject && isBackgroundImageLocked) {
          console.log("🔒 Cannot delete locked background image");
          return false;
        }
        if (obj === backgroundImageObject) {
          console.log("🖼️ Background image can only be removed from Settings");
          return false;
        }
        return true;
      });

      objectsToDelete.forEach((object) => canvas.remove(object));
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
    centerObjects: () => {
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length === 0) return;

      const workspace = getWorkspace();
      if (!workspace) return;

      // Get workspace boundaries
      const workspaceCenter = workspace.getCenterPoint();

      activeObjects.forEach((obj) => {
        // Center the object at workspace center
        obj.setPositionByOrigin(
          new fabric.Point(workspaceCenter.x, workspaceCenter.y),
          "center",
          "center",
        );
      });

      canvas.renderAll();
      save();
    },
    centerObjectsHorizontally: () => {
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length === 0) return;

      const workspace = getWorkspace();
      if (!workspace) return;

      const workspaceCenter = workspace.getCenterPoint();

      activeObjects.forEach((obj) => {
        obj.set({
          left: workspaceCenter.x,
          originX: "center",
        });
      });

      canvas.renderAll();
      save();
    },
    centerObjectsVertically: () => {
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length === 0) return;

      const workspace = getWorkspace();
      if (!workspace) return;

      const workspaceCenter = workspace.getCenterPoint();

      activeObjects.forEach((obj) => {
        obj.set({
          top: workspaceCenter.y,
          originY: "center",
        });
      });

      canvas.renderAll();
      save();
    },
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
