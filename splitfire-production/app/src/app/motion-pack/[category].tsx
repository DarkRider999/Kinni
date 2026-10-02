import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { Header } from "@/components/Header";
import { GlowCard } from "@/components/GlowCard";
import { MotionStagePreview } from "@/components/MotionStagePreview";
import { getCategory, getItemsForCategory } from "@/data/motionCatalog";
import { useProjectConfig } from "@/state/projectStore";
import { colors, neonColorSwatches } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";
import type { MotionItem } from "@/types";

const THUMB = 76;

export default function CategoryItemsScreen() {
  const { category: categoryId } = useLocalSearchParams<{ category: string }>();
  const category = getCategory(categoryId);
  const items = getItemsForCategory(categoryId);

  return (
    <ScreenBackground>
      <Header
        title={category?.title ?? "Motion Pack"}
        subtitle={`${items.length} items`}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/motion-pack"))}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>{category?.description}</Text>
        <View style={styles.list}>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

function ItemRow({ item }: { item: MotionItem }) {
  const [config] = useProjectConfig(item.id, item);
  const accent = neonColorSwatches[item.accent].hex;

  return (
    <Pressable onPress={() => router.push({ pathname: "/preview/[itemId]", params: { itemId: item.id } })}>
      <GlowCard accentColor={accent} style={styles.row}>
        <View style={styles.thumbWrap}>
          <MotionStagePreview pattern={item.pattern} config={config} width={THUMB} height={THUMB} compact playing={false} />
        </View>
        <View style={styles.rowTextCol}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            {item.kind === "poster" ? (
              <View style={styles.posterBadge}>
                <Text style={styles.posterBadgeText}>POSTER</Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={2} style={styles.rowDescription}>
            {item.description}
          </Text>
          <View style={styles.rowMeta}>
            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textMuted} />
            <Text style={styles.rowMetaText}>{item.duration}</Text>
            {item.bpmReady ? (
              <>
                <MaterialCommunityIcons name="metronome" size={12} color={colors.textMuted} style={{ marginLeft: 8 }} />
                <Text style={styles.rowMetaText}>Beat sync</Text>
              </>
            ) : null}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
      </GlowCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  description: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  thumbWrap: { borderRadius: radius.sm, overflow: "hidden" },
  rowTextCol: { flex: 1 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  posterBadge: {
    backgroundColor: "rgba(27,231,255,0.15)",
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  posterBadgeText: { fontSize: 9, fontWeight: "800", color: colors.neonBlueSoft, letterSpacing: 0.5 },
  rowDescription: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  rowMeta: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  rowMetaText: { ...typography.caption, color: colors.textMuted, marginLeft: 4 },
});
