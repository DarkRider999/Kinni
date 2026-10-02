import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

interface ParticleFieldProps {
  density: number; // 0-100
  color: string;
  width: number;
  height: number;
  speedMs?: number;
}

interface ParticleSeed {
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
}

const MAX_PARTICLES = 42;

/** Lightweight drifting-spark layer. Particle count scales with `density` (0-100). */
export function ParticleField({ density, color, width, height, speedMs = 3200 }: ParticleFieldProps) {
  const count = Math.max(2, Math.round((density / 100) * MAX_PARTICLES));

  const seeds = useMemo<ParticleSeed[]>(
    () =>
      Array.from({ length: MAX_PARTICLES }).map((_, index) => ({
        left: ((index * 37) % 100) + (index % 3),
        size: 2 + (index % 4),
        delay: (index * 97) % 1400,
        duration: speedMs + ((index * 53) % 900),
        drift: (index % 2 === 0 ? 1 : -1) * (6 + (index % 5) * 3),
      })),
    [speedMs]
  );

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      {seeds.slice(0, count).map((seed, index) => (
        <Particle key={index} seed={seed} color={color} height={height} width={width} />
      ))}
    </View>
  );
}

function Particle({ seed, color, height, width }: { seed: ParticleSeed; color: string; height: number; width: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: seed.duration,
        delay: seed.delay,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, seed.delay, seed.duration]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height * 0.15, -height * 0.25],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, seed.drift, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.8, 1],
    outputRange: [0, 1, 0.8, 0],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: (seed.left / 100) * width,
        top: height * 0.55,
        width: seed.size,
        height: seed.size,
        borderRadius: seed.size,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }],
        shadowColor: color,
        shadowOpacity: 0.9,
        shadowRadius: 4,
      }}
    />
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden", borderRadius: 24 },
});
