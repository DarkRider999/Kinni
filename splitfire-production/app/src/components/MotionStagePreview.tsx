import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/typography";
import { ParticleField } from "./ParticleField";
import type { ProjectConfig, StagePattern } from "@/types";

const logoSource = require("../../assets/brand-logo-square.png");
const TYPEWRITER_SAMPLE = "RADICALMIX";

interface MotionStagePreviewProps {
  pattern: StagePattern;
  config: ProjectConfig;
  width: number;
  height: number;
  /** When false, the stage renders a single still frame at `config.timelinePhase` instead of looping. */
  playing?: boolean;
  compact?: boolean;
}

/**
 * SplitFire's real-time procedural motion-graphics stage. This renders every
 * category (logo reveals, transitions, loops, text, event visuals, overlay FX)
 * live on-device from the active color / glow / particle / beat-sync config,
 * so every "Generate" and scrub action produces an immediate, genuine result.
 */
export function MotionStagePreview({ pattern, config, width, height, playing = true, compact = false }: MotionStagePreviewProps) {
  const phase = useRef(new Animated.Value(config.timelinePhase)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current?.stop();
    if (!playing) {
      phase.setValue(config.timelinePhase);
      return;
    }
    const duration = config.beatSyncEnabled
      ? Math.max(650, (60000 / Math.max(60, config.bpm)) * 2)
      : 2600;
    phase.setValue(0);
    const loop = Animated.loop(
      Animated.timing(phase, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })
    );
    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [playing, config.beatSyncEnabled, config.bpm, config.timelinePhase, phase]);

  const glow = config.glowIntensity / 100;
  const primaryHex = swatchHex(config.primaryColor);
  const secondaryHex = swatchHex(config.secondaryColor);
  const logoSize = compact ? Math.min(width, height) * 0.26 : Math.min(width, height) * 0.32;

  return (
    <View style={[styles.stage, { width, height }]}>
      <LinearGradient colors={["#0D0417", "#070210", "#05010A"]} style={StyleSheet.absoluteFill} />

      {pattern === "pulse-rings" && <PulseRings phase={phase} primary={primaryHex} secondary={secondaryHex} glow={glow} width={width} height={height} />}
      {pattern === "sweep" && <SweepBar phase={phase} primary={primaryHex} secondary={secondaryHex} width={width} height={height} />}
      {pattern === "burst" && <BurstPop phase={phase} primary={primaryHex} glow={glow} logoSize={logoSize} />}
      {pattern === "scanlines" && <Scanlines phase={phase} color={secondaryHex} width={width} height={height} />}
      {pattern === "strobe" && <Strobe phase={phase} color={primaryHex} />}
      {pattern === "typewriter" && <Typewriter phase={phase} color={primaryHex} compact={compact} />}

      {playing && <ParticleField density={config.particleDensity} color={secondaryHex} width={width} height={height} />}

      {pattern !== "typewriter" && (
        <View
          pointerEvents="none"
          style={[
            styles.logoBadge,
            {
              width: logoSize,
              height: logoSize,
              borderRadius: logoSize * 0.22,
              shadowColor: primaryHex,
              shadowOpacity: 0.35 + glow * 0.5,
              shadowRadius: 10 + glow * 24,
            },
          ]}
        >
          <Image source={logoSource} style={{ width: logoSize, height: logoSize, borderRadius: logoSize * 0.22 }} />
        </View>
      )}

      {config.beatSyncEnabled && (
        <View style={styles.bpmPill} pointerEvents="none">
          <Text style={styles.bpmText}>{Math.round(config.bpm)} BPM</Text>
        </View>
      )}
    </View>
  );
}

function swatchHex(id: ProjectConfig["primaryColor"]) {
  switch (id) {
    case "red":
      return colors.neonRed;
    case "blue":
      return colors.neonBlue;
    case "purple":
      return colors.neonPurple;
    case "white":
      return colors.textPrimary;
    default:
      return colors.neonRed;
  }
}

function PulseRings({
  phase,
  primary,
  secondary,
  glow,
  width,
  height,
}: {
  phase: Animated.Value;
  primary: string;
  secondary: string;
  glow: number;
  width: number;
  height: number;
}) {
  const base = Math.min(width, height);
  const rings = [
    { color: primary, offset: 0 },
    { color: secondary, offset: 0.33 },
    { color: primary, offset: 0.66 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {rings.map((ring, index) => {
        const shifted = Animated.modulo(Animated.add(phase, ring.offset), 1);
        return (
          <Animated.View
            key={index}
            style={{
              position: "absolute",
              alignSelf: "center",
              top: height / 2,
              left: width / 2,
              width: base * 0.5,
              height: base * 0.5,
              marginLeft: -(base * 0.25),
              marginTop: -(base * 0.25),
              borderRadius: base,
              borderWidth: 2,
              borderColor: ring.color,
              opacity: shifted.interpolate({
                inputRange: [0, 0.15, 1],
                outputRange: [0.1 + glow * 0.5, 0.2 + glow * 0.6, 0],
              }),
              transform: [
                {
                  scale: shifted.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.9] }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

function SweepBar({
  phase,
  primary,
  secondary,
  width,
  height,
}: {
  phase: Animated.Value;
  primary: string;
  secondary: string;
  width: number;
  height: number;
}) {
  const barWidth = width * 0.4;
  const translateX = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [-barWidth, width + barWidth],
  });
  const rotate = "18deg";
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -height * 0.2,
        left: 0,
        width: barWidth,
        height: height * 1.4,
        transform: [{ translateX }, { rotate }],
      }}
    >
      <LinearGradient
        colors={["transparent", primary, secondary, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1, opacity: 0.85 }}
      />
    </Animated.View>
  );
}

function BurstPop({ phase, primary, glow, logoSize }: { phase: Animated.Value; primary: string; glow: number; logoSize: number }) {
  const scale = phase.interpolate({ inputRange: [0, 0.12, 0.3, 1], outputRange: [1, 1.22, 1, 1] });
  const ringOpacity = phase.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 0.6 + glow * 0.3, 0.1, 0] });
  const ringScale = phase.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={{
          position: "absolute",
          alignSelf: "center",
          top: "50%",
          left: "50%",
          width: logoSize * 1.6,
          height: logoSize * 1.6,
          marginLeft: -(logoSize * 0.8),
          marginTop: -(logoSize * 0.8),
          borderRadius: logoSize,
          borderWidth: 2,
          borderColor: primary,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ scale }],
        }}
      />
    </View>
  );
}

function Scanlines({ phase, color, width, height }: { phase: Animated.Value; color: string; width: number; height: number }) {
  const translateY = phase.interpolate({ inputRange: [0, 1], outputRange: [-height * 0.3, height * 1.3] });
  const flicker = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.85, 0.5] });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[0, 1, 2, 3].map((row) => (
        <View
          key={row}
          style={{
            position: "absolute",
            top: (height / 5) * (row + 1),
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        />
      ))}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: height * 0.22,
          transform: [{ translateY }],
          opacity: flicker,
        }}
      >
        <LinearGradient colors={["transparent", color, "transparent"]} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

function Strobe({ phase, color }: { phase: Animated.Value; color: string }) {
  const opacity = phase.interpolate({
    inputRange: [0, 0.06, 0.12, 0.5, 0.56, 0.62, 1],
    outputRange: [0, 0.55, 0, 0, 0.4, 0, 0],
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity }]} />
  );
}

function Typewriter({ phase, color, compact }: { phase: Animated.Value; color: string; compact: boolean }) {
  const [revealCount, setRevealCount] = React.useState(0);
  useEffect(() => {
    const id = phase.addListener(({ value }) => {
      const cycled = value < 0.75 ? value / 0.75 : 1;
      setRevealCount(Math.floor(cycled * TYPEWRITER_SAMPLE.length));
    });
    return () => phase.removeListener(id);
  }, [phase]);

  return (
    <View style={styles.typewriterWrap} pointerEvents="none">
      <Text style={[styles.typewriterText, { color, fontSize: compact ? 20 : 30 }]}>
        {TYPEWRITER_SAMPLE.slice(0, revealCount)}
        <Text style={styles.cursor}>|</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadge: {
    position: "absolute",
    overflow: "visible",
  },
  bpmPill: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  bpmText: { color: colors.neonBlueSoft, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  typewriterWrap: { alignItems: "center", justifyContent: "center" },
  typewriterText: { fontWeight: "800", letterSpacing: 2 },
  cursor: { opacity: 0.6 },
});
