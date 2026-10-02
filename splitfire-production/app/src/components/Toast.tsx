import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";
import type { IconName } from "@/types";

interface ToastState {
  message: string;
  icon: IconName;
  tone: "success" | "info";
}

interface ToastContextValue {
  show: (message: string, options?: { icon?: IconName; tone?: "success" | "info" }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, options?: { icon?: IconName; tone?: "success" | "info" }) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ message, icon: options?.icon ?? "check-circle", tone: options?.tone ?? "success" });
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          setToast(null);
        });
      }, 2200);
    },
    [anim]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              top: insets.top + spacing.sm,
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
              ],
              borderColor: toast.tone === "success" ? colors.success : colors.neonBlue,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={toast.icon}
            size={18}
            color={toast.tone === "success" ? colors.success : colors.neonBlue}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(12,6,20,0.96)",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 999,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: { ...typography.bodyStrong, color: colors.textPrimary, marginLeft: 8 },
});
