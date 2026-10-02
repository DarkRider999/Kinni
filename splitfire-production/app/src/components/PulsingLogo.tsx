import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";

interface PulsingLogoProps {
  size?: number;
  active?: boolean;
}

const logoSource = require("../../assets/brand-logo-square.png");

/** The glossy-R mark with breathing neon rings, used on Splash and as a brand motif. */
export function PulsingLogo({ size = 160, active = true }: PulsingLogoProps) {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const makeLoop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 1800,
            delay,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const loop1 = makeLoop(pulse1, 0);
    const loop2 = makeLoop(pulse2, 900);
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [active, pulse1, pulse2]);

  const ringStyle = (value: Animated.Value, color: string) => ({
    opacity: value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.55, 0.4, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.5] }) }],
    borderColor: color,
  });

  return (
    <View style={[styles.wrap, { width: size * 1.8, height: size * 1.8 }]}>
      <Animated.View
        style={[styles.ring, { width: size * 1.3, height: size * 1.3, borderRadius: size }, ringStyle(pulse1, colors.neonRed)]}
      />
      <Animated.View
        style={[styles.ring, { width: size * 1.3, height: size * 1.3, borderRadius: size }, ringStyle(pulse2, colors.neonPurple)]}
      />
      <View
        style={[
          styles.logoShadowWrap,
          { width: size, height: size, borderRadius: size * 0.22 },
        ]}
      >
        <Image source={logoSource} style={{ width: size, height: size, borderRadius: size * 0.22 }} resizeMode="cover" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1.5 },
  logoShadowWrap: {
    shadowColor: colors.neonRed,
    shadowOpacity: 0.65,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
});
