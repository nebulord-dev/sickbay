import React from "react";
import { Box, Text } from "ink";

interface PanelBorderProps {
  title: string;
  color: string;
  focused?: boolean;
  visible?: boolean;
  children: React.ReactNode;
}

export function PanelBorder({ title, color, focused, visible = true, children }: PanelBorderProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle={focused ? "double" : "single"}
      borderColor={focused ? color : "gray"}
      paddingX={1}
      flexGrow={1}
    >
      <Text bold color={color}>
        {title}
      </Text>
      {visible ? children : <Text dimColor>···</Text>}
    </Box>
  );
}
