import React from "react";
import { Box, Text } from "ink";

interface PanelBorderProps {
  title: string;
  color: string;
  focused?: boolean;
  visible?: boolean;
  flash?: "green" | "red";
  children: React.ReactNode;
}

export function PanelBorder({ title, color, focused, visible = true, flash, children }: PanelBorderProps) {
  const borderColor = flash ?? (focused ? color : "gray");
  const borderStyle = flash ? "double" : (focused ? "double" : "single");

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      borderColor={borderColor}
      paddingX={1}
      flexGrow={1}
    >
      <Text bold color={flash ?? color}>
        {title}
      </Text>
      {visible ? children : <Text dimColor>···</Text>}
    </Box>
  );
}
