import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenBackground } from "@/components/ScreenBackground";
import { Header } from "@/components/Header";
import { GlowCard } from "@/components/GlowCard";
import { SectionHeader } from "@/components/SectionHeader";
import { MotionStagePreview } from "@/components/MotionStagePreview";
import { brandName, colorPalette, logoPack, motionSamples, studioName, typeSpecimens } from "@/data/brandKit";
import { colors, neonColorSwatches } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";
import type { ProjectConfig } from "@/types";

const MOTION_THUMB = 100;

function sampleConfig(accent: ProjectConfig["primaryColor"]): ProjectConfig {
  return {
    primaryColor: accent,
    secondaryColor: accent === "blue" ? "purple" : "blue",
    glowIntensity: 70,
    particleDensity: 40,
    beatSyncEnabled: false,
    bpm: 128,
    timelinePhase: 0,
  };
}

export default function BrandKitScreen() {
  return (
    <ScreenBackground>
      <Header title="Brand Kit" subtitle={`${brandName} · ${studioName}`} onBack={() => router.replace("/home")} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Logo pack" subtitle="Primary marks & hero artwork" />
        <View style={styles.logoGrid}>
          {logoPack.map((logo) => (
            <GlowCard key={logo.id} accentColor={colors.neonRed} style={styles.logoCard} padded={false}>
              <Image source={logo.source} style={styles.logoImage} resizeMode="cover" />
              <View style={styles.logoTextWrap}>
                <Text style={styles.logoLabel}>{logo.label}</Text>
                <Text style={styles.logoDescription}>{logo.description}</Text>
                <View style={styles.usagePill}>
                  <Text style={styles.usagePillText}>{logo.usage}</Text>
                </View>
              </View>
            </GlowCard>
          ))}
        </View>

        <SectionHeader title="Color palette" subtitle="Core neon trio + stage neutrals" />
        <View style={styles.paletteGrid}>
          {colorPalette.map((swatch) => (
            <View key={swatch.id} style={styles.paletteItem}>
              <View style={[styles.paletteSwatch, { backgroundColor: swatch.hex, shadowColor: swatch.hex }]} />
              <Text style={styles.paletteLabel}>{swatch.label}</Text>
              <Text style={styles.paletteHex}>{swatch.hex.toUpperCase()}</Text>
              <Text style={styles.paletteRole}>{swatch.role}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Typography" subtitle="Type scale used across the app" />
        <GlowCard accentColor={colors.neonBlue} style={styles.typeCard}>
          {typeSpecimens.map((spec, index) => (
            <View
              key={spec.id}
              style={[styles.typeRow, index !== typeSpecimens.length - 1 && styles.typeRowDivider]}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: spec.weight as "400" | "600" | "700" | "800",
                  fontSize: spec.size,
                }}
                numberOfLines={1}
              >
                {spec.sample}
              </Text>
              <Text style={styles.typeMeta}>
                {spec.label} · {spec.size}px / {spec.weight}
              </Text>
            </View>
          ))}
        </GlowCard>

        <SectionHeader title="Motion" subtitle="Signature motion-engine presets" />
        <View style={styles.motionGrid}>
          {motionSamples.map((sample) => (
            <View key={sample.id} style={styles.motionItem}>
              <View style={styles.motionThumbWrap}>
                <MotionStagePreview
                  pattern={sample.pattern}
                  config={sampleConfig(sample.accent)}
                  width={MOTION_THUMB}
                  height={MOTION_THUMB}
                  compact
                />
              </View>
              <Text style={styles.motionLabel}>{sample.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  logoGrid: { gap: spacing.sm, marginBottom: spacing.xl },
  logoCard: { overflow: "hidden" },
  logoImage: { width: "100%", height: 160 },
  logoTextWrap: { padding: spacing.md },
  logoLabel: { ...typography.h3, color: colors.textPrimary },
  logoDescription: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  usagePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,27,75,0.12)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  usagePillText: { ...typography.caption, color: colors.neonRedSoft, fontSize: 10.5 },
  paletteGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  paletteItem: { width: "30%", alignItems: "center" },
  paletteSwatch: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    marginBottom: 6,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  paletteLabel: { ...typography.caption, color: colors.textPrimary, textAlign: "center", fontWeight: "700" },
  paletteHex: { fontSize: 10, color: colors.textMuted, marginTop: 1, fontVariant: ["tabular-nums"] },
  paletteRole: { fontSize: 9.5, color: colors.textMuted, textAlign: "center", marginTop: 1 },
  typeCard: { marginBottom: spacing.xl },
  typeRow: { paddingVertical: spacing.sm },
  typeRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  typeMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4, fontSize: 10.5 },
  motionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  motionItem: { alignItems: "center", gap: 6, width: "22%" },
  motionThumbWrap: { borderRadius: radius.sm, overflow: "hidden" },
  motionLabel: { fontSize: 10.5, color: colors.textSecondary, textAlign: "center" },
  footerSpace: { height: spacing.xl },
});
