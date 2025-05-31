import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const updateBackground = () => {
      const backgroundInfo = editor?.getBackgroundImageInfo?.();
      if (backgroundInfo?.imageUrl) {
        setBackgroundImage(backgroundInfo.imageUrl);
        setIsBackgroundLocked(backgroundInfo.isLocked);
        setBackgroundImageSize({
          width: backgroundInfo.width || 0,
          height: backgroundInfo.height || 0,
        });
      } else {
        setBackgroundImage(null);
        setIsBackgroundLocked(false);
        setBackgroundImageSize({ width: 0, height: 0 });
      }
    };

    updateBackground();

    const canvas = editor?.canvas;
    if (canvas) {
      const onObjectAdded = () => {
        const background = canvas
          .getObjects()
          .find(
            (obj: any) =>
              obj.name === "backgroundImage" || obj.isBackgroundImage,
          );
        if (background) {
          setBackgroundImage(background.imageUrl || background.src);
          setIsBackgroundLocked(background.isLocked || false);
          setBackgroundImageSize({
            width: background.width || 0,
            height: background.height || 0,
          });
        }
      };

      canvas.on("object:added", onObjectAdded);
      canvas.on("object:modified", onObjectAdded);

      return () => {
        canvas.off("object:added", onObjectAdded);
        canvas.off("object:modified", onObjectAdded);
      };
    }
  }, [editor]);

  useEffect(() => {
    const backgroundInfo = editor?.getBackgroundImageInfo?.();
    if (backgroundInfo?.imageUrl) {
      setBackgroundImage(backgroundInfo.imageUrl);
      setIsBackgroundLocked(backgroundInfo.isLocked);
      setBackgroundImageSize({
        width: backgroundInfo.width || 0,
        height: backgroundInfo.height || 0,
      });
    }
  }, [editor]);

  useEffect(() => {
    editor?.setBackgroundStateChangeListener?.((state) => {
      setBackgroundImage(state.backgroundImage);
      setIsBackgroundLocked(state.isBackgroundLocked);
      setBackgroundImageSize(state.backgroundImageSize);
    });
  }, [editor]);

  useEffect(() => {
    setWidth(initialWidth);
    setHeight(initialHeight);
    setBackground(initialBackground);
  }, [initialWidth, initialHeight, initialBackground]);

  useEffect(() => {
    console.log("backgroundImage", backgroundImage);
  }, []);

  const changeWidth = (value: string) => setWidth(value);
  const changeHeight = (value: string) => setHeight(value);
  const changeBackground = (value: string) => {
    setBackground(value);
    editor?.changeBackground(value);
  };

  const handleBackgroundImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;

        setBackgroundImage(imageUrl);
        console.log(event);

        const img = new Image();
        img.onload = () => {
          setBackgroundImageSize({ width: img.width, height: img.height });
          editor?.setBackgroundImage?.(imageUrl, false);
        };
        img.src = imageUrl;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const toggleBackgroundLock = () => {
    if (backgroundImage) {
      const newLockState = !isBackgroundLocked;
      setIsBackgroundLocked(newLockState);
      editor?.setBackgroundImageLock?.(newLockState);
    }
  };

  const removeBackgroundImage = () => {
    setBackgroundImage(null);
    setIsBackgroundLocked(false);
    setBackgroundImageSize({ width: 0, height: 0 });
    editor?.removeBackgroundImage?.();
  };

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

          {!backgroundImage ? (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleBackgroundImageUpload}
                className="hidden"
                id="background-upload"
              />
              <Label
                htmlFor="background-upload"
                className="flex h-32 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-gray-400"
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
                  disabled={!backgroundImage}
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
                  />
                  <Label
                    htmlFor="background-replace"
                    className="flex w-full cursor-pointer items-center justify-center rounded border border-gray-300 py-2 text-sm transition-colors hover:bg-gray-50"
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
