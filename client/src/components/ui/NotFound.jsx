import React from "react";
import { Box, Button, HStack, Image, Text, VStack } from "@chakra-ui/react";
import {
  FiAlertTriangle,
  FiHome,
  FiArrowLeft,
  FiRefreshCw,
} from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import image404 from "@/assets/engineer-404.gif";
const keyframes = `
@keyframes appPulseAmber {
  0%, 100% { opacity: 0.65; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.03); }
}
@keyframes appWobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}
@keyframes appGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.25); }
  50% { box-shadow: 0 0 0 7px rgba(245, 158, 11, 0.10); }
}
`;

const QUIPS = [
  "Tried turning it off and on again. The page still didn’t come back.",
  "DNS says no. Routing says nope. Physics says good luck.",
  "This URL has been placed on hold pending approval from the Change Advisory Board.",
  "We checked the logs. The logs checked out emotionally.",
  "This page is currently experiencing an outage in your imagination.",
  "If this link worked in prod, it would be a sev-1. Thankfully, it doesn’t.",
  "Ticket created: ‘User navigated to the void.’ Priority: Medium. Mood: Concerned.",
  "We replaced the cable. Still 404. Classic.",
];

function pickQuip() {
  return QUIPS[Math.floor(Math.random() * QUIPS.length)];
}

export default function NotFound({
  title = "404: Page Not Found",
  message = "You wandered into a route that doesn’t exist. It happens. Mostly to users. Sometimes to engineers.",
  // Put a gif in: /public/gifs/engineer-404.gif  (or any path under /public)
  gifSrc = "/gifs/engineer-404.gif",
  minH = "calc(100vh - 64px)",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [quip, setQuip] = React.useState(pickQuip());

  return (
    <Box
      minH={minH}
      display="grid"
      placeItems="center"
      px={6}
      py={10}
      bgColor="#F8FAFC"
    >
      <style>{keyframes}</style>

      <Box
        w="full"
        maxW="1200px"
        borderRadius="18px"
        border="1px solid #FCD34D"
        bgColor="#FFFFFF"
        boxShadow="0 18px 45px rgba(0,0,0,0.10)"
        overflow="hidden"
      >
        {/* Top accent bar */}
        <Box
          h="6px"
          bgColor="#F59E0B"
          style={{ animation: "appPulseAmber 1.9s ease-in-out infinite" }}
        />

        <Box px={8} py={7}>
          <HStack align="start" gap={6} flexWrap="wrap">
            {/* Left: Icon + Text */}
            <VStack align="stretch" flex="1" minW="280px" gap={4}>
              <HStack gap={3} align="center">
                <Box
                  display="grid"
                  placeItems="center"
                  w="56px"
                  h="56px"
                  borderRadius="14px"
                  bgColor="#FFFBEB"
                  border="1px solid #FCD34D"
                  color="#B45309"
                  style={{ animation: "appGlow 1.6s ease-in-out infinite" }}
                >
                  <Box
                    style={{ animation: "appWobble 1.2s ease-in-out infinite" }}
                  >
                    <FiAlertTriangle size={28} />
                  </Box>
                </Box>

                <Box>
                  <Text fontSize="sm" letterSpacing="0.12em" color="#92400E">
                    LOST IN ROUTING
                  </Text>
                  <Text
                    fontSize="2xl"
                    fontWeight="900"
                    color="#111827"
                    lineHeight="1.1"
                  >
                    {title}
                  </Text>
                </Box>
              </HStack>

              <Text fontSize="md" color="#374151">
                {message}
              </Text>

              {/* Quip */}
              <Box
                borderRadius="12px"
                border="1px solid #FDE68A"
                bgColor="#FFFBEB"
                px={4}
                py={3}
              >
                <HStack justify="space-between" align="start" gap={3}>
                  <Text
                    fontSize="sm"
                    color="#92400E"
                    style={{
                      animation: "appPulseAmber 1.8s ease-in-out infinite",
                    }}
                  >
                    {quip}
                  </Text>

                  <Button
                    onClick={() => setQuip(pickQuip())}
                    size="xs"
                    bgColor="#FFFFFF"
                    color="#92400E"
                    border="1px solid #FCD34D"
                    _hover={{ bgColor: "#FFFBEB" }}
                    leftIcon={<FiRefreshCw />}
                    flexShrink={0}
                  >
                    New
                  </Button>
                </HStack>
              </Box>

              {/* Path */}
              <Box
                borderRadius="12px"
                border="1px solid #E5E7EB"
                bgColor="#F9FAFB"
                px={4}
                py={3}
              >
                <Text fontSize="xs" color="#6B7280">
                  Requested path
                </Text>
                <Text
                  fontSize="sm"
                  fontFamily="mono"
                  color="#111827"
                  wordBreak="break-word"
                >
                  {location.pathname}
                </Text>
              </Box>

              {/* Actions */}
              <HStack gap={3} pt={1} flexWrap="wrap">
                <Button
                  leftIcon={<FiArrowLeft />}
                  onClick={() => navigate(-1)}
                  bgColor="#FFFFFF"
                  color="#92400E"
                  border="1px solid #FCD34D"
                  _hover={{ bgColor: "#FFFBEB" }}
                  _active={{ bgColor: "#FEF3C7" }}
                  size="sm"
                >
                  Go Back
                </Button>

                <Button
                  leftIcon={<FiHome />}
                  onClick={() => navigate("/")}
                  bgColor="#F59E0B"
                  color="#111827"
                  _hover={{ bgColor: "#D97706" }}
                  _active={{ bgColor: "#B45309" }}
                  size="sm"
                >
                  Home
                </Button>
              </HStack>
            </VStack>

            {/* Right: GIF */}
            <Box
              w="600px"
              minW="600px"
              borderRadius="16px"
              overflow="hidden"
              display="grid"
              placeItems="center"
              px={3}
              py={3}
            >
              <img
                src={image404}
                alt="Support engineer dealing with a 404"
                w="500px"
                maxH="1200px"
                objectFit="contain"
                borderRadius="12px"
              />
              <Text mt={2} fontSize="xs" color="#92400E" textAlign="center">
                Status: “Investigating” <br /> (translation: coffee first)
              </Text>
            </Box>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}
