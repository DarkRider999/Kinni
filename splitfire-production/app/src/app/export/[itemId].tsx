import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { captureRef } from "react-native-view-shot";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { Header } from "@/components/Header";
import { GlowCard } from "@/components/GlowCard";
import { SectionHeader } from "@/components/SectionHeader";
import { ChipSelector } from "@/components/ChipSelector";
import { ToggleRow } from "@/components/ToggleRow";
import { NeonButton } from "@/components/NeonButton";
import { MotionStagePreview } from "@/components/MotionStagePreview";
import { getItem } from "@/data/motionCatalog";
import { useExportConfig, useGeneratedAsset, useProjectConfig } from "@/state/projectStore";
import { runExportPipeline, saveSnapshotToDevice, type ExportProgressEvent } from "@/services/exportService";
import { useToast } from "@/components/Toast";
import { colors, neonColorSwatches } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";

const stageLabels: Record<ExportProgressEvent["stage"], string> = {
  rendering: "Rendering motion stage…",
  encoding: "Encoding frames…",
  finalizing: "Finalizing file…",
  done: "Done",
};

export default function ExportScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const item = getItem(itemId);
  const { width } = useWindowDimensions();
  const stageSize = Math.min(width - spacing.md * 2, 340);
  const toast = useToast();

  const [config] = useProjectConfig(itemId, item);
  const [exportConfig, updateExportConfig] = useExportConfig(itemId);
  const [asset] = useGeneratedAsset(itemId, item);
  const stageRef = useRef<View>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState<ExportProgressEvent["stage"] | null>(null);
  const [lastResult, setLastResult] = useState<{ saved: boolean; shared: boolean; dims: string } | null>(null);

  if (!item) {
    return (
      <ScreenBackground>
        <Header title="Not found" onBack={() => router.replace("/motion-pack")} />
      </ScreenBackground>
    );
  }

  const accent = neonColorSwatches[config.primaryColor].hex;
  const displayConfig = exportConfig.neonEnhance
    ? { ...config, glowIntensity: Math.min(100, config.glowIntensity + 25) }
    : config;

  const handleDownload = async () => {
    setIsExporting(true);
    setLastResult(null);
    try {
      const result = await runExportPipeline(exportConfig, (event) => {
        setProgress(event.progress);
        setStageLabel(event.stage);
      });

      const uri = await captureRef(stageRef, { format: "png", quality: 1 });
      const saveResult = await saveSnapshotToDevice(uri, `${item.title} — SplitFire Production`);

      setLastResult({ saved: saveResult.saved, shared: saveResult.shared, dims: result.pixelDimensions });
      toast.show(saveResult.saved ? "Saved to Photos" : "Ready to share", {
        icon: saveResult.saved ? "check-circle" : "share-variant",
      });
    } catch (error) {
      toast.show("Export failed — try again", { icon: "alert-circle-outline", tone: "info" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ScreenBackground>
      <Header title="Export" subtitle={item.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View
          ref={stageRef}
          collapsable={false}
          style={[styles.stageWrap, { width: stageSize, height: stageSize, shadowColor: accent }]}
        >
          <MotionStagePreview pattern={item.pattern} config={displayConfig} width={stageSize} height={stageSize} playing={false} />
        </View>

        {!asset || asset.status !== "complete" ? (
          <View style={styles.warnBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={styles.warnText}>Not generated yet — exporting will use the current live-edit config.</Text>
          </View>
        ) : null}

        <GlowCard accentColor={accent} style={styles.card}>
          <SectionHeader title="Resolution" />
          <ChipSelector
            options={[
              { value: "1080p", label: "1080p", caption: "1920×1080" },
              { value: "4k", label: "4K", caption: "3840×2160" },
            ]}
            value={exportConfig.resolution}
            onChange={(v) => updateExportConfig({ resolution: v })}
            accentColor={accent}
          />
        </GlowCard>

        <GlowCard accentColor={colors.neonBlue} style={styles.card}>
          <SectionHeader title="Format" />
          <ChipSelector
            options={[
              { value: "mp4", label: "MP4" },
              { value: "mov", label: "MOV" },
            ]}
            value={exportConfig.format}
            onChange={(v) => updateExportConfig({ format: v })}
            accentColor={colors.neonBlue}
          />
        </GlowCard>

        <GlowCard accentColor={colors.neonPurple} style={styles.card}>
          <ToggleRow
            label="Loop"
            description="Export as a seamless, beat-matched loop"
            icon="repeat"
            value={exportConfig.loop}
            onValueChange={(v) => updateExportConfig({ loop: v })}
            accentColor={colors.neonPurple}
          />
          <ToggleRow
            label="Neon enhancement"
            description="Boost glow & bloom on the final render"
            icon="creation"
            value={exportConfig.neonEnhance}
            onValueChange={(v) => updateExportConfig({ neonEnhance: v })}
            accentColor={colors.neonRed}
          />
        </GlowCard>

        {isExporting ? (
          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>{stageLabel ? stageLabels[stageLabel] : "Preparing…"}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: accent }]} />
            </View>
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
        ) : null}

        {lastResult ? (
          <View style={styles.resultBanner}>
            <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
            <Text style={styles.resultText}>
              {exportConfig.format.toUpperCase()} · {lastResult.dims} {exportConfig.loop ? "· Loop" : ""} —{" "}
              {lastResult.saved ? "saved to your photo library" : "ready to share"}.
            </Text>
          </View>
        ) : null}

        <NeonButton
          label={isExporting ? "Exporting…" : "Download"}
          icon="tray-arrow-down"
          fullWidth
          size="lg"
          loading={isExporting}
          onPress={handleDownload}
        />
        <Text style={styles.footnote}>
          Full {exportConfig.format.toUpperCase()} video rendering runs through the same pipeline once a cloud render
          backend is connected — this build exports a production-ready high-resolution frame today.
        </Text>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, alignItems: "center" },
  stageWrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,201,60,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,201,60,0.3)",
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    width: "100%",
  },
  warnText: { ...typography.caption, color: colors.warning, flex: 1 },
  card: { width: "100%", marginBottom: spacing.md },
  progressWrap: { width: "100%", marginBottom: spacing.md },
  progressLabel: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressPercent: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  resultBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(44,255,176,0.1)",
    borderWidth: 1,
    borderColor: "rgba(44,255,176,0.3)",
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    width: "100%",
  },
  resultText: { ...typography.caption, color: colors.success, flex: 1 },
  footnote: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
});
