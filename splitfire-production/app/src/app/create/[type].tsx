import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { Header } from "@/components/Header";
import { GlowCard } from "@/components/GlowCard";
import { MotionStagePreview } from "@/components/MotionStagePreview";
import { getItemsByTag, getItemsByKind } from "@/data/motionCatalog";
import { useProjectConfig } from "@/state/projectStore";
import { colors, neonColorSwatches } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";
import type { IconName, MotionItem, QuickActionType } from "@/types";

const THUMB = 84;

const typeMeta: Record<QuickActionType, { title: string; subtitle: string; icon: IconName }> = {
  intro: { title: "Create Intro", subtitle: "Logo reveals built to open your set", icon: "alpha-r-circle" },
  poster: { title: "Create Poster", subtitle: "Hologram posters for gigs & drops", icon: "image-frame" },
  reel: { title: "Create Reel", subtitle: "Loop-ready overlays for short-form cuts", icon: "movie-open-play" },
};

function itemsForType(type: QuickActionType): MotionItem[] {
  if (type === "poster") return getItemsByKind("poster");
  return getItemsByTag(type === "intro" ? "Intro" : "Reel");
}

export default function CreateQuickActionScreen() {
  const { type } = useLocalSearchParams<{ type: QuickActionType }>();
  const meta = typeMeta[type] ?? typeMeta.intro;
  const items = useMemo(() => itemsForType(type), [type]);

  return (
    <ScreenBackground>
      <Header title={meta.title} subtitle={meta.subtitle} onBack={() => router.replace("/home")} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <MaterialCommunityIcons name={meta.icon} size={20} color={colors.neonRedSoft} />
          <Text style={styles.bannerText}>Pick a starting template — every parameter stays editable after.</Text>
        </View>
        <View style={styles.list}>
          {items.map((item) => (
            <QuickItemRow key={item.id} item={item} />
          ))}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

function QuickItemRow({ item }: { item: MotionItem }) {
  const [config] = useProjectConfig(item.id, item);
  const accent = neonColorSwatches[item.accent].hex;
  return (
    <Pressable onPress={() => router.push({ pathname: "/preview/[itemId]", params: { itemId: item.id } })}>
      <GlowCard accentColor={accent} style={styles.row}>
        <View style={styles.thumbWrap}>
          <MotionStagePreview pattern={item.pattern} config={config} width={THUMB} height={THUMB} compact playing={false} />
        </View>
        <View style={styles.rowTextCol}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text numberOfLines={2} style={styles.rowDescription}>
            {item.description}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
      </GlowCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,27,75,0.08)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  thumbWrap: { borderRadius: radius.sm, overflow: "hidden" },
  rowTextCol: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  rowDescription: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
