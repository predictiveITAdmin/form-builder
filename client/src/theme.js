import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          blue: { value: "#21519e" },
          green: { value: "#32a852" },
        },
      },
    },

    semanticTokens: {
      colors: {
        // App surfaces
        "app.bg": { value: "{colors.gray.100}" },
        "topbar.bg": { value: "{colors.white}" },
        "surface.bg": { value: "{colors.white}" },

        // Text
        "text.primary": { value: "{colors.gray.900}" },
        "text.muted": { value: "{colors.gray.600}" },

        // Brand
        "brand.primary": { value: "{colors.brand.blue}" },
        "brand.secondary": { value: "{colors.brand.green}" },
      },
    },

    recipes: {
      button: {
        base: {
          borderRadius: "lg",
          fontWeight: "semibold",
        },
        variants: {
          solid: {
            bg: "brand.primary",
            color: "white",
            _hover: { bg: "brand.primary", opacity: 0.92 },
            _active: { opacity: 0.85 },
          },
          secondary: {
            bg: "brand.secondary",
            color: "white",
            _hover: { bg: "brand.secondary", opacity: 0.92 },
            _active: { opacity: 0.85 },
          },
          outline: {
            borderColor: "brand.primary",
            color: "brand.primary",
            _hover: { bg: "blue.50" },
          },
        },
        defaultVariants: {
          variant: "solid",
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
