import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { Header } from "@/components/Header";
import { motionCategories, getItemsForCategory } from "@/data/motionCatalog";
import { colors } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";

export default function MotionPackScreen() {
  return (
    <ScreenBackground>
      <Header title="Motion Pack" subtitle="6 categories · tap to explore" onBack={() => router.replace("/home")} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {motionCategories.map((category) => {
            const count = getItemsForCategory(category.id).length;
            return (
              <Pressable
                key={category.id}
                style={styles.cardWrap}
                onPress={() => router.push({ pathname: "/motion-pack/[category]", params: { category: category.id } })}
              >
                <LinearGradient
                  colors={["#140A22", "#0A0512"]}
                  style={styles.card}
                >
                  <LinearGradient
                    colors={category.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconWrap}
                  >
                    <MaterialCommunityIcons name={category.icon} size={24} color={colors.textOnNeon} />
                  </LinearGradient>
                  <Text style={styles.cardTitle}>{category.title}</Text>
                  <Text numberOfLines={2} style={styles.cardDescription}>
                    {category.description}
                  </Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardCount}>{count} items</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color={colors.textSecondary} />
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cardWrap: { width: "47%" },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 170,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  cardTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  cardDescription: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  cardCount: { ...typography.label, color: colors.textMuted },
});
