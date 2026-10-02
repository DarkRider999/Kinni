import React, { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { Header } from "@/components/Header";
import { GlowCard } from "@/components/GlowCard";
import { NeonButton } from "@/components/NeonButton";
import { MotionStagePreview } from "@/components/MotionStagePreview";
import { getCategory, getItem } from "@/data/motionCatalog";
import { useGeneratedAsset, useLibrary, useProjectConfig } from "@/state/projectStore";
import { generateAsset } from "@/services/generationService";
import { useToast } from "@/components/Toast";
import { colors, neonColorSwatches } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";
import type { IconName } from "@/types";

export default function PreviewScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const item = getItem(itemId);
  const category = item ? getCategory(item.categoryId) : undefined;
  const { width } = useWindowDimensions();
  const stageSize = Math.min(width - spacing.md * 2, 420);
  const toast = useToast();
  const library = useLibrary();

  const [config] = useProjectConfig(itemId, item);
  const [asset, updateAsset] = useGeneratedAsset(itemId, item);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!item) {
    return (
      <ScreenBackground>
        <Header title="Not found" onBack={() => router.replace("/motion-pack")} />
      </ScreenBackground>
    );
  }

  const isGenerating = asset.status === "generating";
  const isGenerated = asset.status === "complete";

  const handleGenerate = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    updateAsset({ status: "generating", progress: 0 });
    try {
      const result = await generateAsset({
        itemId,
        config,
        onProgress: (progress) => updateAsset({ progress }),
        signal: controller.signal,
      });
      updateAsset({ status: "complete", progress: 100, config, generatedAt: result.generatedAt });
      toast.show("Generation complete", { icon: "check-circle" });
    } catch {
      updateAsset({ status: "error" });
    }
  };

  const handleDownload = () => {
    if (!isGenerated) {
      toast.show("Generate it first", { icon: "alert-circle-outline", tone: "info" });
      return;
    }
    router.push({ pathname: "/export/[itemId]", params: { itemId } });
  };

  const handleAddToProject = () => {
    library.add(itemId);
    toast.show("Added to Project", { icon: "folder-plus-outline" });
  };

  const accent = neonColorSwatches[item.accent].hex;

  return (
    <ScreenBackground>
      <Header
        title={item.title}
        subtitle={category?.title}
        right={
          <Pressable onPress={() => router.push({ pathname: "/editor/[itemId]", params: { itemId } })} hitSlop={10}>
            <MaterialCommunityIcons name="tune-variant" size={22} color={colors.textPrimary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.stageWrap, { width: stageSize, height: stageSize, shadowColor: accent }]}>
          <MotionStagePreview pattern={item.pattern} config={config} width={stageSize} height={stageSize} playing />
          {isGenerating ? (
            <View style={styles.progressOverlay}>
              <Text style={styles.progressPercent}>{Math.round(asset.progress)}%</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${asset.progress}%`, backgroundColor: accent }]} />
              </View>
              <Text style={styles.progressLabel}>Rendering with SplitFire Motion Engine…</Text>
            </View>
          ) : null}
          {isGenerated ? (
            <View style={styles.generatedBadge}>
              <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
              <Text style={styles.generatedBadgeText}>Generated</Text>
            </View>
          ) : null}
        </View>

        <GlowCard accentColor={accent} style={styles.descCard}>
          <View style={styles.descHeaderRow}>
            <Text style={styles.descTitle}>{item.title}</Text>
            <View style={styles.kindBadge}>
              <Text style={styles.kindBadgeText}>{item.kind === "poster" ? "POSTER" : "VIDEO"}</Text>
            </View>
          </View>
          <Text style={styles.descBody}>{item.description}</Text>
          <View style={styles.tagRow}>
            {item.tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <View style={styles.metaRow}>
            <MetaStat icon="clock-outline" label={item.duration} />
            <MetaStat icon="shimmer" label={category?.title ?? ""} />
            {item.bpmReady ? <MetaStat icon="metronome" label="Beat-syncable" /> : null}
          </View>
        </GlowCard>

        <View style={styles.actions}>
          <NeonButton
            label={isGenerating ? "Generating…" : isGenerated ? "Regenerate" : "Generate"}
            icon="creation"
            onPress={handleGenerate}
            loading={isGenerating}
            fullWidth
            size="lg"
          />
          <View style={styles.secondaryRow}>
            <NeonButton
              label="Download"
              icon="tray-arrow-down"
              variant="secondary"
              onPress={handleDownload}
              style={styles.secondaryBtn}
            />
            <NeonButton
              label="Add to Project"
              icon="folder-plus-outline"
              variant="ghost"
              onPress={handleAddToProject}
              style={styles.secondaryBtn}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

function MetaStat({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.metaStat}>
      <MaterialCommunityIcons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.metaStatText}>{label}</Text>
    </View>
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
  progressOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: "rgba(5,1,10,0.78)",
  },
  progressPercent: { ...typography.h2, color: colors.textPrimary, marginBottom: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 6 },
  generatedBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  generatedBadgeText: { ...typography.caption, color: colors.success, fontSize: 11 },
  descCard: { width: "100%", marginBottom: spacing.md },
  descHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  descTitle: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  kindBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindBadgeText: { fontSize: 10, fontWeight: "800", color: colors.textSecondary, letterSpacing: 0.5 },
  descBody: { ...typography.body, color: colors.textSecondary, marginTop: 8 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  tagChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
  metaRow: { flexDirection: "row", gap: 14, marginTop: spacing.sm },
  metaStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaStatText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  actions: { width: "100%", gap: spacing.sm },
  secondaryRow: { flexDirection: "row", gap: spacing.sm },
  secondaryBtn: { flex: 1 },
});
