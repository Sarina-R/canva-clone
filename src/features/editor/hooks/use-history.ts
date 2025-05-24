import { fabric } from "fabric";
import { useCallback, useRef, useState } from "react";

import { JSON_KEYS } from "@/features/editor/types";

interface UseHistoryProps {
  canvas: fabric.Canvas | null;
  saveCallback?: (values: {
    json: string;
    height: number;
    width: number;
  }) => void;
}

export const useHistory = ({ canvas, saveCallback }: UseHistoryProps) => {
  const [historyIndex, setHistoryIndex] = useState(0);
  const canvasHistory = useRef<string[]>([]);
  const skipSave = useRef(false);

  const canUndo = useCallback(() => {
    return historyIndex > 0;
  }, [historyIndex]);

  const canRedo = useCallback(() => {
    return historyIndex < canvasHistory.current.length - 1;
  }, [historyIndex]);

  const save = useCallback(() => {
    if (!canvas) return;

    // 🔍 Count dynamic elements before saving state
    let dynamicCount = 0;
    canvas.getObjects().forEach((obj: any) => {
      if (obj.get("isDynamic")) dynamicCount++;
    });

    const currentState = JSON.stringify(canvas.toJSON(JSON_KEYS));

    // 🎉 EASTER EGG: Log state saves with dynamic info
    if (dynamicCount > 0) {
      console.log(
        `💾 State saved with ${dynamicCount} dynamic elements preserved!`,
      );
    }

    // Your existing save logic here...
    canvasHistory.current = [
      ...canvasHistory.current.slice(0, historyIndex + 1),
      currentState,
    ];
    setHistoryIndex(canvasHistory.current.length - 1);

    if (saveCallback) {
      const workspace = canvas
        .getObjects()
        .find((obj) => obj.name === "clip") as fabric.Rect;
      saveCallback({
        json: currentState,
        height: workspace?.height || 900,
        width: workspace?.width || 1200,
      });
    }
  }, [canvas, historyIndex, saveCallback]);

  const undo = useCallback(() => {
    if (canUndo()) {
      skipSave.current = true;
      canvas?.clear().renderAll();

      const previousIndex = historyIndex - 1;
      const previousState = JSON.parse(canvasHistory.current[previousIndex]);

      canvas?.loadFromJSON(previousState, () => {
        canvas.renderAll();
        setHistoryIndex(previousIndex);
        skipSave.current = false;
      });
    }
  }, [canUndo, canvas, historyIndex]);

  const redo = useCallback(() => {
    if (canRedo()) {
      skipSave.current = true;
      canvas?.clear().renderAll();

      const nextIndex = historyIndex + 1;
      const nextState = JSON.parse(canvasHistory.current[nextIndex]);

      canvas?.loadFromJSON(nextState, () => {
        canvas.renderAll();
        setHistoryIndex(nextIndex);
        skipSave.current = false;
      });
    }
  }, [canvas, historyIndex, canRedo]);

  return {
    save,
    canUndo,
    canRedo,
    undo,
    redo,
    setHistoryIndex,
    canvasHistory,
  };
};
