import React from "react";
import { Box, Text } from "ink";

export type PanelId = "health" | "git" | "trend" | "quickwins" | "activity";

interface HotkeyBarProps {
  activePanel: PanelId | null;
}

const HOTKEYS: Array<{ key: string; label: string; panel?: PanelId }> = [
  { key: "h", label: "health", panel: "health" },
  { key: "g", label: "git", panel: "git" },
  { key: "t", label: "trend", panel: "trend" },
  { key: "q", label: "quick wins", panel: "quickwins" },
  { key: "a", label: "activity", panel: "activity" },
  { key: "r", label: "re-run" },
  { key: "w", label: "web" },
  { key: "W", label: "web+AI" },
  { key: "?", label: "help" },
];

export function HotkeyBar({ activePanel }: HotkeyBarProps) {
  return (
    <Box>
      {HOTKEYS.map((hk) => {
        const isActive = hk.panel !== undefined && hk.panel === activePanel;
        return (
          <Box key={hk.key} marginRight={2}>
            <Text bold={isActive} color={isActive ? "cyan" : undefined}>
              [{hk.key}]
            </Text>
            <Text bold={isActive} color={isActive ? "cyan" : "gray"}>
              {" "}
              {hk.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
