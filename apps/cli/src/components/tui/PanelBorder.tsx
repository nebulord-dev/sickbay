import React from "react";
import { Box, Text } from "ink";

interface PanelBorderProps {
  title: string;
  color: string;
  focused?: boolean;
  children: React.ReactNode;
}

export function PanelBorder({ title, color, focused, children }: PanelBorderProps) {
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
      {children}
    </Box>
  );
}
