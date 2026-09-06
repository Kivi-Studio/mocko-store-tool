"use client";

import { useRef } from "react";
import { ImagePlus, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import type {
  Background,
  DeviceStyle,
  Project,
  TextStyle,
} from "@/lib/model/types";
import { PRESETS, getPreset } from "@/lib/model/presets";
import { FONT_OPTIONS } from "@/lib/model/fonts";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/model/limits";
import {
  CLAIM_SIZE_MAX,
  CLAIM_SIZE_MIN,
  DEVICE_SCALE_MAX,
  DEVICE_SCALE_MIN,
  SUB_SIZE_MAX,
  SUB_SIZE_MIN,
  TEXT_WIDTH_MAX,
  TEXT_WIDTH_MIN,
  TOP_SPACE_MAX,
  TOP_SPACE_MIN,
} from "@/lib/model/limits";
import { fileToImageId } from "@/lib/storage/upload";
import { exportProjectFile, readProjectFile } from "@/lib/storage/project-file";
import { APP_VERSION } from "@/lib/version";
import { useProjectStore } from "@/store/useProjectStore";
import { useAddShots } from "./useAddShots";
import {
  ColorField,
  LabeledSlider,
  PanelSection,
  SegmentedControl,
  SwatchRow,
} from "./controls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FRAME_SWATCHES = [
  "#0B0B0D",
  "#3A3D42",
  "#C9CCD1",
  "#F2F2F5",
  "#E3C9A0",
  "#2B6CFF",
] as const;

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function EditorSidebar({ project }: { project: Project }) {
  const patchSettings = useProjectStore((s) => s.patchSettings);
  const addProject = useProjectStore((s) => s.addProject);
  const addShots = useAddShots(project.id);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const shotsFileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const preset = getPreset(project.presetId);
  // Text sizes are stored as a fraction of canvas width but shown as the pixels
  // they resolve to in the chosen export format: a familiar, concrete unit
  // that matches the pixels in the exported file exactly.
  const px = (v: number) => `${Math.round(preset.w * v)} px`;

  const setBackground = (bg: Background) =>
    patchSettings(project.id, { background: bg });
  const setText = (patch: Partial<TextStyle>) =>
    patchSettings(project.id, { text: { ...project.text, ...patch } });
  const setDevice = (patch: Partial<DeviceStyle>) =>
    patchSettings(project.id, { device: { ...project.device, ...patch } });

  const bg = project.background;

  const handleBgImage = async (file?: File) => {
    if (!file) return;
    try {
      const imageId = await fileToImageId(file);
      setBackground({ type: "image", imageId });
    } catch (error) {
      console.error(error);
      toast.error("Could not load background image");
    }
  };

  const handleSave = async () => {
    try {
      await exportProjectFile(project);
    } catch (error) {
      console.error(error);
      toast.error("Could not save project file");
    }
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await readProjectFile(file);
      const id = addProject(imported);
      toast.success("Project imported");
      window.location.assign(`/project/?id=${id}`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Could not read file",
      );
    }
  };

  return (
    <aside className="bg-card w-80 shrink-0 space-y-6 overflow-y-auto border-r p-4">
      {/* Format */}
      <PanelSection title="Export format">
        <Select
          value={project.presetId}
          onValueChange={(v) =>
            patchSettings(project.id, { presetId: String(v) })
          }
          items={PRESETS.map((p) => ({ value: p.id, label: p.name }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {preset.w} × {preset.h} px · {preset.fileType.toUpperCase()}
        </p>
      </PanelSection>

      <Separator />

      {/* Background */}
      <PanelSection title="Background">
        <SegmentedControl
          ariaLabel="Background type"
          value={bg.type}
          options={[
            { value: "gradient", label: "Gradient" },
            { value: "solid", label: "Solid" },
            { value: "image", label: "Image" },
          ]}
          onChange={(type) => {
            if (type === bg.type) return;
            if (type === "gradient")
              setBackground({
                type: "gradient",
                from: "#6C8CFF",
                to: "#3A1D8A",
                angle: 135,
              });
            else if (type === "solid")
              setBackground({ type: "solid", color: "#4A6BFF" });
            else setBackground({ type: "image", imageId: null });
          }}
        />

        {bg.type === "gradient" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">From</Label>
                <ColorField
                  label="Gradient start"
                  value={bg.from}
                  onChange={(from) => setBackground({ ...bg, from })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">To</Label>
                <ColorField
                  label="Gradient end"
                  value={bg.to}
                  onChange={(to) => setBackground({ ...bg, to })}
                />
              </div>
            </div>
            <LabeledSlider
              label="Angle"
              value={bg.angle}
              min={0}
              max={360}
              onChange={(angle) => setBackground({ ...bg, angle })}
              format={(v) => `${v}°`}
            />
          </div>
        )}

        {bg.type === "solid" && (
          <ColorField
            label="Background color"
            value={bg.color}
            onChange={(color) => setBackground({ type: "solid", color })}
          />
        )}

        {bg.type === "image" && (
          <div className="space-y-2">
            <input
              ref={bgFileRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                void handleBgImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => bgFileRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              {bg.imageId ? "Replace image" : "Choose image"}
            </Button>
          </div>
        )}
      </PanelSection>

      <Separator />

      {/* Text */}
      <PanelSection title="Text">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Color</Label>
          <ColorField
            label="Text color"
            value={project.text.color}
            onChange={(color) => setText({ color })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Alignment</Label>
          <SegmentedControl
            ariaLabel="Text alignment"
            value={project.text.align}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
            onChange={(align) => setText({ align })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Font</Label>
          <Select
            value={project.text.font}
            onValueChange={(v) => setText({ font: String(v) })}
            items={FONT_OPTIONS.map((f) => ({
              value: f.value,
              label: f.label,
            }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <LabeledSlider
          label="Claim size"
          value={project.text.claimSize}
          min={CLAIM_SIZE_MIN}
          max={CLAIM_SIZE_MAX}
          step={0.001}
          onChange={(claimSize) => setText({ claimSize })}
          format={px}
        />
        <LabeledSlider
          label="Subtext size"
          value={project.text.subSize}
          min={SUB_SIZE_MIN}
          max={SUB_SIZE_MAX}
          step={0.001}
          onChange={(subSize) => setText({ subSize })}
          format={px}
        />
      </PanelSection>

      <Separator />

      {/* Device & layout */}
      <PanelSection title="Device & layout">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Frame color</Label>
          <SwatchRow
            value={project.device.frameColor}
            colors={FRAME_SWATCHES}
            onChange={(frameColor) => setDevice({ frameColor })}
          />
          <ColorField
            label="Custom frame color"
            value={project.device.frameColor}
            onChange={(frameColor) => setDevice({ frameColor })}
          />
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={project.device.edge}
            onChange={(e) => setDevice({ edge: e.target.checked })}
          />
          Thin frame outline (for same-color backgrounds)
        </label>
        <LabeledSlider
          label="Device size"
          value={project.device.scale}
          min={DEVICE_SCALE_MIN}
          max={DEVICE_SCALE_MAX}
          step={0.01}
          onChange={(scale) => setDevice({ scale })}
          format={pct}
        />
        <LabeledSlider
          label="Top text space"
          value={project.device.topSpace}
          min={TOP_SPACE_MIN}
          max={TOP_SPACE_MAX}
          step={0.01}
          onChange={(topSpace) => setDevice({ topSpace })}
          format={pct}
        />
        <LabeledSlider
          label="Text width"
          value={project.text.textWidth}
          min={TEXT_WIDTH_MIN}
          max={TEXT_WIDTH_MAX}
          step={0.01}
          onChange={(textWidth) => setText({ textWidth })}
          format={pct}
        />
      </PanelSection>

      <Separator />

      {/* Screenshots */}
      <PanelSection title="Screenshots">
        <input
          ref={shotsFileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addShots(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => shotsFileRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          Add screenshots
        </Button>
      </PanelSection>

      <Separator />

      {/* Project file */}
      <PanelSection title="Project file">
        <input
          ref={importFileRef}
          type="file"
          accept=".studio,application/zip"
          className="hidden"
          onChange={(e) => {
            void handleImportFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => void handleSave()}>
            <Save className="size-4" />
            Save
          </Button>
          <Button
            variant="outline"
            onClick={() => importFileRef.current?.click()}
          >
            <Upload className="size-4" />
            Load
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Saves screenshots, captions and all settings as a <code>.studio</code>{" "}
          file.
        </p>
      </PanelSection>

      <p className="text-muted-foreground pt-2 text-center text-xs">
        Mocko v{APP_VERSION} · Powered by{" "}
        <a
          href="https://www.kivistudio.de"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground font-medium underline underline-offset-2"
        >
          Kivi Studio
        </a>
      </p>
    </aside>
  );
}
