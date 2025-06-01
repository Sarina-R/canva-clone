import { useEffect, useMemo, useState, useCallback } from "react";
import { Lock, Unlock, Upload, X } from "lucide-react";

import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { ColorPicker } from "@/features/editor/components/color-picker";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SettingsSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
}

export const SettingsSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: SettingsSidebarProps) => {
  const workspace = editor?.getWorkspace();

  const initialWidth = useMemo(() => `${workspace?.width ?? 900}`, [workspace]);
  const initialHeight = useMemo(
    () => `${workspace?.height ?? 1200}`,
    [workspace],
  );
  const initialBackground = useMemo(
    () => workspace?.fill ?? "#ffffff",
    [workspace],
  );

  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [background, setBackground] = useState(initialBackground);

  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isBackgroundLocked, setIsBackgroundLocked] = useState(false);
  const [backgroundImageSize, setBackgroundImageSize] = useState({
    width: 0,
    height: 0,
  });

  const [backgroundStateReady, setBackgroundStateReady] = useState(false);

  const updateBackgroundFromCanvas = useCallback(() => {
    const canvas = editor?.canvas;
    if (!canvas) {
      console.log("❌ Canvas not available");
      return;
    }

    try {
      console.log("🔍 Scanning canvas for background image...");

      const backgroundObj = canvas.getObjects().find((obj: any) => {
        return (
          obj.name === "backgroundImage" ||
          obj.isBackgroundImage === true ||
          obj.data?.isBackgroundImage === true
        );
      });

      if (backgroundObj) {
        console.log("✅ Background image found:", backgroundObj);

        const imageUrl =
          (backgroundObj as any).imageUrl ||
          (backgroundObj as any).src ||
          (backgroundObj as any).data?.imageUrl ||
          (backgroundObj as any)._element?.src ||
          (backgroundObj as any)._originalElement?.src;

        const isLocked =
          (backgroundObj as any).isLocked === true ||
          (backgroundObj as any).lockMovementX === true ||
          !(backgroundObj as any).selectable;

        console.log("📊 Background info extracted:", {
          imageUrl: imageUrl ? imageUrl.substring(0, 50) + "..." : "No URL",
          isLocked,
          width: (backgroundObj as any).width,
          height: (backgroundObj as any).height,
        });

        if (imageUrl) {
          setBackgroundImage(imageUrl);
          setIsBackgroundLocked(isLocked);
          setBackgroundImageSize({
            width: (backgroundObj as any).width || 0,
            height: (backgroundObj as any).height || 0,
          });
          setBackgroundStateReady(true);
          return;
        }
      }

      console.log("❌ No background image found, resetting state");
      setBackgroundImage(null);
      setIsBackgroundLocked(false);
      setBackgroundImageSize({ width: 0, height: 0 });
      setBackgroundStateReady(true);
    } catch (error) {
      console.error("❌ Error scanning for background:", error);
      setBackgroundStateReady(true);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor?.canvas) return;

    console.log("🔄 Checking for saved canvas state...");

    const savedState = localStorage.getItem("canvasState");
    if (savedState) {
      try {
        const data = JSON.parse(savedState);
        const backgroundState = data.backgroundImageState;

        console.log("💾 Found saved background state:", backgroundState);

        if (backgroundState?.hasBackgroundImage && backgroundState?.imageUrl) {
          console.log("🖼️ Setting background from localStorage");
          setBackgroundImage(backgroundState.imageUrl);
          setIsBackgroundLocked(backgroundState.isLocked || false);
          setBackgroundImageSize(
            backgroundState.dimensions || { width: 0, height: 0 },
          );
          setBackgroundStateReady(true);
          return;
        }
      } catch (error) {
        console.error("❌ Error parsing saved state:", error);
      }
    }

    const timer = setTimeout(() => {
      updateBackgroundFromCanvas();
    }, 200);

    return () => clearTimeout(timer);
  }, [editor, updateBackgroundFromCanvas]);

  useEffect(() => {
    const canvas = editor?.canvas;
    if (!canvas) return;

    const handleCanvasReady = () => {
      console.log("🎨 Canvas ready, updating background state...");
      setTimeout(updateBackgroundFromCanvas, 100);
    };

    const handleObjectChange = (e?: any) => {
      if (!backgroundStateReady) return;

      console.log("🔄 Canvas object changed:", e?.type);

      if (
        e?.target?.name === "backgroundImage" ||
        e?.target?.isBackgroundImage
      ) {
        console.log("🖼️ Background object changed, updating state...");
        setTimeout(updateBackgroundFromCanvas, 50);
      }
    };

    const events = [
      "object:added",
      "object:removed",
      "object:modified",
      "object:moving",
      "selection:created",
      "selection:cleared",
    ];

    if (canvas.getObjects().length >= 0) {
      handleCanvasReady();
    }

    events.forEach((event) => {
      canvas.on(event, handleObjectChange);
    });

    return () => {
      events.forEach((event) => {
        canvas.off(event, handleObjectChange);
      });
    };
  }, [editor, updateBackgroundFromCanvas, backgroundStateReady]);

  useEffect(() => {
    if (editor?.setBackgroundStateChangeListener) {
      console.log("📡 Setting up editor background listener...");

      editor.setBackgroundStateChangeListener((state) => {
        console.log("📡 Editor background state changed:", state);

        setBackgroundImage(state.backgroundImage);
        setIsBackgroundLocked(state.isBackgroundLocked);
        setBackgroundImageSize(
          state.backgroundImageSize || { width: 0, height: 0 },
        );
        setBackgroundStateReady(true);
      });
    }
  }, [editor]);

  useEffect(() => {
    setWidth(initialWidth);
    setHeight(initialHeight);
    setBackground(initialBackground);
  }, [initialWidth, initialHeight, initialBackground]);

  const changeWidth = (value: string) => setWidth(value);
  const changeHeight = (value: string) => setHeight(value);
  const changeBackground = (value: string) => {
    setBackground(value);
    editor?.changeBackground(value);
  };

  const handleBackgroundImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && editor) {
        console.log("📤 Uploading new background image...");

        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;

          const img = new Image();
          img.onload = () => {
            console.log("✅ New background image loaded:", {
              url: imageUrl.substring(0, 50) + "...",
              width: img.width,
              height: img.height,
            });

            setBackgroundImage(imageUrl);
            setBackgroundImageSize({ width: img.width, height: img.height });
            setIsBackgroundLocked(false);

            if (editor.setBackgroundImage) {
              editor.setBackgroundImage(imageUrl, false);
            }
          };
          img.src = imageUrl;
        };
        reader.readAsDataURL(file);
      }
      e.target.value = "";
    },
    [editor],
  );

  const toggleBackgroundLock = useCallback(() => {
    if (backgroundImage && editor) {
      const newLockState = !isBackgroundLocked;
      console.log(
        `🔐 Toggling background lock: ${isBackgroundLocked} -> ${newLockState}`,
      );

      setIsBackgroundLocked(newLockState);

      if (editor.setBackgroundImageLock) {
        editor.setBackgroundImageLock(newLockState);
      }
    }
  }, [backgroundImage, isBackgroundLocked, editor]);

  const removeBackgroundImage = useCallback(() => {
    console.log("🗑️ Removing background image...");

    setBackgroundImage(null);
    setIsBackgroundLocked(false);
    setBackgroundImageSize({ width: 0, height: 0 });

    if (editor?.removeBackgroundImage) {
      editor.removeBackgroundImage();
    }
  }, [editor]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    editor?.changeSize({
      width: parseInt(width, 10),
      height: parseInt(height, 10),
    });
  };

  const onClose = () => {
    onChangeActiveTool("select");
  };

  const isEditorReady = editor && editor.canvas && backgroundStateReady;

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-white",
        activeTool === "settings" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="Settings"
        description="Change the look of your workspace"
      />
      <ScrollArea>
        <form className="space-y-4 p-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Height</Label>
            <Input
              placeholder="Height"
              value={height}
              type="number"
              onChange={(e) => changeHeight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Width</Label>
            <Input
              placeholder="Width"
              value={width}
              type="number"
              onChange={(e) => changeWidth(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Resize
          </Button>
        </form>

        {/* Background Color Section */}
        <div className="border-t p-4">
          <div className="mb-3">
            <Label className="text-sm font-medium">Background Color</Label>
            <p className="mt-1 text-xs text-gray-500">
              Default background color (visible when no image is set)
            </p>
          </div>
          <ColorPicker
            value={background as string}
            onChange={changeBackground}
          />
        </div>

        {/* Background Image Section */}
        <div className="border-t p-4">
          <div className="mb-3">
            <Label className="text-sm font-medium">Background Image</Label>
            <p className="mt-1 text-xs text-gray-500">
              Upload an image to use as workspace background
            </p>
          </div>

          {!backgroundStateReady ? (
            <div className="mb-4 flex items-center justify-center rounded-md bg-blue-50 p-4 text-sm text-blue-800">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              Loading background state...
            </div>
          ) : !isEditorReady ? (
            <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              Editor is initializing... Please wait.
            </div>
          ) : null}

          {!backgroundImage ? (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleBackgroundImageUpload}
                className="hidden"
                id="background-upload"
                disabled={!isEditorReady}
              />
              <Label
                htmlFor="background-upload"
                className={cn(
                  "flex h-32 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-gray-400",
                  !isEditorReady && "cursor-not-allowed opacity-50",
                )}
              >
                <div className="text-center">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Click to upload image
                  </span>
                  <p className="mt-1 text-xs text-gray-400">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              </Label>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Image Preview */}
              <div className="relative">
                <img
                  src={backgroundImage}
                  alt="Background preview"
                  className="h-32 w-full rounded-lg border object-cover"
                />
                {isBackgroundLocked && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                    <div className="rounded-full bg-white/90 p-2">
                      <Lock className="h-4 w-4 text-gray-700" />
                    </div>
                  </div>
                )}
              </div>

              {/* Image Info */}
              <div className="space-y-1 text-xs text-gray-500">
                <p>
                  Size: {backgroundImageSize.width} ×{" "}
                  {backgroundImageSize.height}px
                </p>
                <p>
                  Status:{" "}
                  <span
                    className={
                      isBackgroundLocked
                        ? "font-medium text-orange-600"
                        : "font-medium text-green-600"
                    }
                  >
                    {isBackgroundLocked
                      ? "🔒 Locked (Protected)"
                      : "🔓 Unlocked (Editable)"}
                  </span>
                </p>
              </div>

              {/* Controls */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={isBackgroundLocked ? "default" : "outline"}
                  size="sm"
                  onClick={toggleBackgroundLock}
                  className="flex-1"
                  disabled={!backgroundImage || !isEditorReady}
                >
                  {isBackgroundLocked ? (
                    <>
                      <Unlock className="mr-1 h-4 w-4" />
                      Unlock
                    </>
                  ) : (
                    <>
                      <Lock className="mr-1 h-4 w-4" />
                      Lock
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={removeBackgroundImage}
                  className="px-3"
                  disabled={!isEditorReady}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Replace Image (only when unlocked) */}
              {!isBackgroundLocked && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundImageUpload}
                    className="hidden"
                    id="background-replace"
                    disabled={!isEditorReady}
                  />
                  <Label
                    htmlFor="background-replace"
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-center rounded border border-gray-300 py-2 text-sm transition-colors hover:bg-gray-50",
                      !isEditorReady && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Replace Image
                  </Label>
                </div>
              )}

              {/* Help Text */}
              <div
                className={`rounded p-3 text-xs ${
                  isBackgroundLocked
                    ? "border border-orange-200 bg-orange-50 text-orange-700"
                    : "border border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {isBackgroundLocked ? (
                  <div>
                    <p className="mb-1 font-medium">🔒 Background Protected</p>
                    <p>
                      Background is locked and safe from accidental changes.
                      Canvas resizing is still available.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1 font-medium">🔓 Background Editable</p>
                    <p>
                      You can move, resize, or replace the background. Click
                      lock to protect it from changes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
};
