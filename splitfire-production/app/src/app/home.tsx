import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenBackground } from "@/components/ScreenBackground";
import { GlowCard } from "@/components/GlowCard";
import { SectionHeader } from "@/components/SectionHeader";
import { colors } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";
import { brandTagline, studioName } from "@/data/brandKit";
import type { IconName, QuickActionType } from "@/types";

const logoSource = require("../../assets/brand-logo-square.png");

interface MainTile {
  title: string;
  description: string;
  icon: IconName;
  gradient: readonly [string, string];
  onPress: () => void;
}

interface QuickAction {
  type: QuickActionType;
  label: string;
  icon: IconName;
}

const quickActions: QuickAction[] = [
  { type: "intro", label: "Create Intro", icon: "alpha-r-circle" },
  { type: "poster", label: "Create Poster", icon: "image-frame" },
  { type: "reel", label: "Create Reel", icon: "movie-open-play" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const mainTiles: MainTile[] = [
    {
      title: "Motion Pack",
      description: "Logo reveals, text FX, event visuals & overlay packs.",
      icon: "shimmer",
      gradient: colors.gradientRedPurple,
      onPress: () => router.push("/motion-pack"),
    },
    {
      title: "Transitions",
      description: "Swipe, shatter & spark cuts to move between scenes.",
      icon: "transition",
      gradient: colors.gradientPurpleBlue,
      onPress: () => router.push("/motion-pack/transitions"),
    },
    {
      title: "Background Loops",
      description: "Seamless looping stage backdrops for your sets.",
      icon: "infinity",
      gradient: ["#1BE7FF", "#FF1B4B"] as const,
      onPress: () => router.push("/motion-pack/background-loops"),
    },
  ];

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Image source={logoSource} style={styles.brandLogo} />
            <View>
              <Text style={styles.studioName}>{studioName}</Text>
              <Text style={styles.tagline}>{brandTagline}</Text>
            </View>
          </View>
          <Pressable style={styles.iconButton} onPress={() => router.push("/brand-kit")} hitSlop={10}>
            <MaterialCommunityIcons name="palette-swatch" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <SectionHeader title="Build your visuals" subtitle="Pick a studio to start generating" />
        <View style={styles.mainTiles}>
          {mainTiles.map((tile) => (
            <Pressable key={tile.title} onPress={tile.onPress} style={styles.tileWrap}>
              <LinearGradient
                colors={tile.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tile}
              >
                <View style={styles.tileIconWrap}>
                  <MaterialCommunityIcons name={tile.icon} size={26} color={colors.textOnNeon} />
                </View>
                <View style={styles.tileTextCol}>
                  <Text style={styles.tileTitle}>{tile.title}</Text>
                  <Text style={styles.tileDescription}>{tile.description}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textOnNeon} />
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        <SectionHeader title="Quick actions" subtitle="Jump straight into a new project" />
        <View style={styles.quickRow}>
          {quickActions.map((action) => (
            <Pressable
              key={action.type}
              style={styles.quickWrap}
              onPress={() => router.push({ pathname: "/create/[type]", params: { type: action.type } })}
            >
              <GlowCard accentColor={colors.neonBlue} style={styles.quickCard}>
                <MaterialCommunityIcons name={action.icon} size={24} color={colors.neonBlueSoft} />
                <Text style={styles.quickLabel}>{action.label}</Text>
              </GlowCard>
            </Pressable>
          ))}
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandLogo: { width: 42, height: 42, borderRadius: 10 },
  studioName: { ...typography.h3, color: colors.textPrimary },
  tagline: { ...typography.caption, color: colors.neonRedSoft, letterSpacing: 1.5, marginTop: 2 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  mainTiles: { gap: spacing.sm, marginBottom: spacing.xl },
  tileWrap: {
    shadowColor: colors.neonPurple,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tileIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileTextCol: { flex: 1 },
  tileTitle: { ...typography.h3, color: colors.textOnNeon },
  tileDescription: { ...typography.caption, color: "rgba(11,7,18,0.75)", marginTop: 2 },
  quickRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  quickWrap: { flex: 1 },
  quickCard: { alignItems: "center", gap: 8, paddingVertical: spacing.md },
  quickLabel: { ...typography.caption, color: colors.textPrimary, textAlign: "center" },
  footerSpace: { height: spacing.xl },
});
