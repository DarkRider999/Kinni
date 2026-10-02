import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { Header } from "@/components/Header";
import { GlowCard } from "@/components/GlowCard";
import { SectionHeader } from "@/components/SectionHeader";
import { SliderRow } from "@/components/SliderRow";
import { ToggleRow } from "@/components/ToggleRow";
import { ChipSelector } from "@/components/ChipSelector";
import { NeonButton } from "@/components/NeonButton";
import { MotionStagePreview } from "@/components/MotionStagePreview";
import { getItem } from "@/data/motionCatalog";
import { useExportConfig, useProjectConfig } from "@/state/projectStore";
import { useToast } from "@/components/Toast";
import { colors, neonColorSwatches, NeonColorId } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";

const NEON_COLOR_IDS: NeonColorId[] = ["red", "purple", "blue", "white"];

export default function EditorScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const item = getItem(itemId);
  const { width } = useWindowDimensions();
  const stageSize = Math.min(width - spacing.md * 2, 380);
  const toast = useToast();

  const [config, updateConfig] = useProjectConfig(itemId, item);
  const [exportConfig, updateExportConfig] = useExportConfig(itemId);
  const [livePreview, setLivePreview] = useState(true);

  if (!item) {
    return (
      <ScreenBackground>
        <Header title="Not found" onBack={() => router.replace("/motion-pack")} />
      </ScreenBackground>
    );
  }

  const accent = neonColorSwatches[config.primaryColor].hex;

  return (
    <ScreenBackground>
      <Header
        title="Editor"
        subtitle={item.title}
        right={
          <Pressable
            onPress={() => {
              toast.show("Project saved", { icon: "content-save-move-outline" });
            }}
            hitSlop={10}
          >
            <MaterialCommunityIcons name="content-save-move-outline" size={22} color={colors.textPrimary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.stageWrap, { width: stageSize, height: stageSize, shadowColor: accent }]}>
          <MotionStagePreview pattern={item.pattern} config={config} width={stageSize} height={stageSize} playing={livePreview} />
          <Pressable style={styles.playToggle} onPress={() => setLivePreview((v) => !v)}>
            <MaterialCommunityIcons name={livePreview ? "pause-circle" : "play-circle"} size={30} color={colors.textPrimary} />
          </Pressable>
        </View>

        <GlowCard accentColor={accent} style={styles.card}>
          <SectionHeader title="Timeline" subtitle={livePreview ? "Live preview looping" : "Scrubbing a still frame"} />
          <SliderRow
            label="Scrub position"
            icon="timeline-outline"
            value={config.timelinePhase * 100}
            onValueChange={(v) => {
              setLivePreview(false);
              updateConfig({ timelinePhase: v / 100 });
            }}
            accentColor={accent}
          />
        </GlowCard>

        <GlowCard accentColor={colors.neonPurple} style={styles.card}>
          <SectionHeader title="Neon color picker" subtitle="Primary & secondary stage colors" />
          <Text style={styles.colorLabel}>Primary</Text>
          <ColorSwatchRow
            selected={config.primaryColor}
            onSelect={(id) => updateConfig({ primaryColor: id })}
          />
          <Text style={[styles.colorLabel, { marginTop: spacing.sm }]}>Secondary</Text>
          <ColorSwatchRow
            selected={config.secondaryColor}
            onSelect={(id) => updateConfig({ secondaryColor: id })}
          />
        </GlowCard>

        <GlowCard accentColor={colors.neonBlue} style={styles.card}>
          <SectionHeader title="Stage dynamics" />
          <SliderRow
            label="Glow intensity"
            icon="blur"
            value={config.glowIntensity}
            onValueChange={(v) => updateConfig({ glowIntensity: v })}
            accentColor={colors.neonRed}
          />
          <SliderRow
            label="Particle density"
            icon="shimmer"
            value={config.particleDensity}
            onValueChange={(v) => updateConfig({ particleDensity: v })}
            accentColor={colors.neonBlue}
          />
          <ToggleRow
            label="Beat sync"
            description="Lock animation timing to a BPM"
            icon="metronome"
            value={config.beatSyncEnabled}
            onValueChange={(v) => updateConfig({ beatSyncEnabled: v })}
            accentColor={colors.neonPurple}
          />
          {config.beatSyncEnabled ? (
            <SliderRow
              label="BPM"
              icon="speedometer"
              value={config.bpm}
              onValueChange={(v) => updateConfig({ bpm: v })}
              minimumValue={60}
              maximumValue={190}
              valueSuffix=""
              accentColor={colors.neonPurple}
            />
          ) : null}
        </GlowCard>

        <GlowCard accentColor={colors.neonRed} style={styles.card}>
          <SectionHeader title="Export options" subtitle="Preset the format before exporting" />
          <Text style={styles.colorLabel}>Format</Text>
          <ChipSelector
            options={[
              { value: "mp4", label: "MP4" },
              { value: "mov", label: "MOV" },
            ]}
            value={exportConfig.format}
            onChange={(v) => updateExportConfig({ format: v })}
            accentColor={colors.neonRed}
          />
          <View style={{ marginTop: spacing.sm }}>
            <ToggleRow
              label="Loop"
              description="Export as a seamless loop"
              icon="repeat"
              value={exportConfig.loop}
              onValueChange={(v) => updateExportConfig({ loop: v })}
              accentColor={colors.neonBlue}
            />
          </View>
        </GlowCard>

        <NeonButton
          label="Continue to Export"
          icon="export-variant"
          iconPosition="right"
          fullWidth
          size="lg"
          onPress={() => router.push({ pathname: "/export/[itemId]", params: { itemId } })}
        />
      </ScrollView>
    </ScreenBackground>
  );
}

function ColorSwatchRow({ selected, onSelect }: { selected: NeonColorId; onSelect: (id: NeonColorId) => void }) {
  return (
    <View style={styles.swatchRow}>
      {NEON_COLOR_IDS.map((id) => {
        const swatch = neonColorSwatches[id];
        const active = id === selected;
        return (
          <Pressable key={id} onPress={() => onSelect(id)} style={styles.swatchWrap}>
            <View
              style={[
                styles.swatch,
                {
                  backgroundColor: swatch.hex,
                  borderColor: active ? colors.textPrimary : "transparent",
                  shadowColor: swatch.hex,
                },
              ]}
            >
              {active ? <MaterialCommunityIcons name="check" size={16} color={colors.textOnNeon} /> : null}
            </View>
            <Text style={styles.swatchLabel}>{swatch.label}</Text>
          </Pressable>
        );
      })}
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
  playToggle: { position: "absolute", bottom: 10, right: 10 },
  card: { width: "100%", marginBottom: spacing.md },
  colorLabel: { ...typography.label, color: colors.textMuted, marginBottom: 8 },
  swatchRow: { flexDirection: "row", gap: spacing.md },
  swatchWrap: { alignItems: "center", gap: 4 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  swatchLabel: { fontSize: 9.5, color: colors.textMuted, maxWidth: 60, textAlign: "center" },
});
