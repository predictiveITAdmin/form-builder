import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, VStack, HStack, IconButton } from "@chakra-ui/react";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiXCircle,
  FiX,
} from "react-icons/fi";
import { notifyStore, dismissNotify } from "./notifyStore";

const stylesByType = {
  success: {
    bg: "green.50",
    border: "green.200",
    icon: FiCheckCircle,
    color: "green.700",
  },
  warning: {
    bg: "yellow.50",
    border: "yellow.200",
    icon: FiAlertTriangle,
    color: "yellow.800",
  },
  info: {
    bg: "blue.50",
    border: "blue.200",
    icon: FiInfo,
    color: "blue.700",
  },
  error: {
    bg: "red.50",
    border: "red.200",
    icon: FiXCircle,
    color: "red.700",
  },
};

const animKeyframes = `
@keyframes toastIn {
  0%   { transform: translate(-50%, -28px) scale(0.98); opacity: 0; }
  100% { transform: translate(-50%, 0px) scale(1); opacity: 1; }
}
@keyframes toastOut {
  0%   { transform: translate(-50%, 0px) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -10px) scale(0.98); opacity: 0; }
}
`;

export default function AppToast({
  placement = "top-center", // top-center | top-right | top-left | bottom-right | bottom-left
  offset = 16,
}) {
  const [toast, setToast] = useState(notifyStore.get());
  const [render, setRender] = useState(notifyStore.get().open);

  useEffect(() => notifyStore.subscribe(setToast), []);

  // Handle smooth exit: keep it rendered briefly to play the outro animation
  useEffect(() => {
    if (toast.open) {
      setRender(true);
      return;
    }
    const t = setTimeout(() => setRender(false), 180);
    return () => clearTimeout(t);
  }, [toast.open]);

  const pos = useMemo(() => {
    const base = { position: "fixed", zIndex: 3000 };

    const map = {
      "top-center": { top: offset, left: "50%" },
      "top-right": { top: offset, right: offset },
      "top-left": { top: offset, left: offset },
      "bottom-right": { bottom: offset, right: offset },
      "bottom-left": { bottom: offset, left: offset },
    };

    return { ...base, ...map[placement] };
  }, [placement, offset]);

  if (!render) return null;

  const { type, title, message, open } = toast;
  const style = stylesByType[type] ?? stylesByType.info;
  const Icon = style.icon;

  // For non-center placements, we don’t need the -50% translate trick
  const isTopCenter = placement === "top-center";

  return (
    <Box {...pos} maxW="520px" w="calc(100vw - 32px)" pointerEvents="none">
      <style>{animKeyframes}</style>

      <Box
        pointerEvents="auto"
        border="1px solid"
        borderColor={style.border}
        bg={style.bg}
        borderRadius="14px"
        px={4}
        py={3}
        // Animation: "roll in" from top, and "roll out" when closed
        style={{
          animation: open
            ? "toastIn 900ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards"
            : "toastOut 400ms ease forwards",
          transform: isTopCenter ? "translate(-50%, 0px)" : undefined,
        }}
      >
        <HStack align="start" gap={3}>
          <Box color={style.color} pt="2px">
            <Icon size={20} />
          </Box>

          <VStack align="start" gap={0.5} flex="1">
            {title ? (
              <Text fontWeight="800" color={style.color} lineHeight="1.2">
                {title}
              </Text>
            ) : null}

            {message ? (
              <Text
                fontSize="sm"
                color={style.color}
                opacity={0.95}
                lineHeight="1.35"
              >
                {message}
              </Text>
            ) : null}
          </VStack>

          <IconButton
            aria-label="Dismiss"
            variant="ghost"
            size="sm"
            onClick={dismissNotify}
          >
            <FiX />
          </IconButton>
        </HStack>
      </Box>
    </Box>
  );
}
