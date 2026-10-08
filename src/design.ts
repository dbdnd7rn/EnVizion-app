import { Platform, type ViewStyle } from "react-native";

/** Shared visual language. Semantic warning/success colors stay distinct. */
export const design = {
  color: {
    ink: "#18163C", muted: "#69647D", purple: "#70338F", deep: "#542267",
    lavender: "#F3ECF9", paper: "#FFFDFC", line: "#E9E0EF",
    rose: "#B43D5C", redBg: "#FFF0F1", green: "#187B57", white: "#FFFFFF",
  },
  font: { display: "Lora_500Medium", body: "DMSans_400Regular", label: "DMSans_600SemiBold", strong: "DMSans_700Bold" },
  radius: { control: 16, card: 24, pill: 999 },
  space: { small: 8, row: 12, control: 16, card: 20, section: 24 },
  motion: { feedback: 160, reveal: 260 },
};

// Opaque native fallbacks preserve contrast without introducing a blur dependency.
/** Radius is supplied by the consuming component. */
export const glassSurface: ViewStyle = {
  backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.88)" : "#FFFFFF",
  borderColor: "#E9E0EF",
  borderWidth: 1,
  shadowColor: "#593068",
  shadowOpacity: 0.055,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 7 },
  elevation: 2,
  ...(Platform.OS === "web" ? {
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: "0 8px 28px rgba(69,35,91,0.055), inset 0 1px 0 rgba(255,255,255,0.95)",
  } : {}),
} as ViewStyle;

export const pageSurface: ViewStyle = {
  backgroundColor: design.color.paper,
  ...(Platform.OS === "web" ? {
    backgroundImage: "radial-gradient(ellipse at 100% 0%, rgba(227,212,246,0.48), transparent 48%), radial-gradient(ellipse at 0% 36%, rgba(250,234,242,0.34), transparent 42%)",
  } : {}),
} as ViewStyle;
