import { FinColors } from "@/constants/theme";
import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

type HelpAssistantMarkdownProps = {
  text: string;
  tone: "user" | "assistant";
};

type InlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; label: string; href: string };

function parseInlineMarkdown(input: string) {
  const tokens: InlineToken[] = [];
  const pattern =
    /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) != null) {
    if (match.index > cursor) {
      tokens.push({
        type: "text",
        value: input.slice(cursor, match.index),
      });
    }

    const chunk = match[0];
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      tokens.push({ type: "bold", value: chunk.slice(2, -2) });
    } else if (chunk.startsWith("*") && chunk.endsWith("*")) {
      tokens.push({ type: "italic", value: chunk.slice(1, -1) });
    } else if (chunk.startsWith("`") && chunk.endsWith("`")) {
      tokens.push({ type: "code", value: chunk.slice(1, -1) });
    } else if (chunk.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(chunk);
      if (linkMatch) {
        tokens.push({
          type: "link",
          label: linkMatch[1],
          href: linkMatch[2],
        });
      } else {
        tokens.push({ type: "text", value: chunk });
      }
    } else {
      tokens.push({ type: "text", value: chunk });
    }

    cursor = match.index + chunk.length;
  }

  if (cursor < input.length) {
    tokens.push({ type: "text", value: input.slice(cursor) });
  }

  return tokens;
}

function renderInlineTokens(tokens: InlineToken[], tone: "user" | "assistant") {
  return tokens.map((token, index) => {
    const key = `tok:${index}`;
    if (token.type === "bold") {
      return (
        <Text key={key} style={styles.bold}>
          {token.value}
        </Text>
      );
    }
    if (token.type === "italic") {
      return (
        <Text key={key} style={styles.italic}>
          {token.value}
        </Text>
      );
    }
    if (token.type === "code") {
      return (
        <Text key={key} style={styles.inlineCode}>
          {token.value}
        </Text>
      );
    }
    if (token.type === "link") {
      return (
        <Text
          key={key}
          style={styles.link}
          onPress={() => {
            void Linking.openURL(token.href);
          }}
        >
          {token.label}
        </Text>
      );
    }
    return <Text key={key}>{token.value}</Text>;
  });
}

function renderLine(
  line: string,
  index: number,
  tone: "user" | "assistant",
) {
  const orderedMatch = /^(\d+)\.\s+(.+)$/.exec(line);
  if (orderedMatch) {
    return (
      <View key={`line:${index}`} style={styles.listRow}>
        <Text style={[styles.listPrefix, tone === "user" && styles.listPrefixUser]}>
          {orderedMatch[1]}.
        </Text>
        <Text style={[styles.lineText, tone === "user" ? styles.userText : styles.assistantText]}>
          {renderInlineTokens(parseInlineMarkdown(orderedMatch[2]), tone)}
        </Text>
      </View>
    );
  }

  const bulletMatch = /^[-*]\s+(.+)$/.exec(line);
  if (bulletMatch) {
    return (
      <View key={`line:${index}`} style={styles.listRow}>
        <Text style={[styles.listPrefix, tone === "user" && styles.listPrefixUser]}>
          •
        </Text>
        <Text style={[styles.lineText, tone === "user" ? styles.userText : styles.assistantText]}>
          {renderInlineTokens(parseInlineMarkdown(bulletMatch[1]), tone)}
        </Text>
      </View>
    );
  }

  return (
    <Text
      key={`line:${index}`}
      style={[styles.lineText, tone === "user" ? styles.userText : styles.assistantText]}
    >
      {renderInlineTokens(parseInlineMarkdown(line), tone)}
    </Text>
  );
}

function splitMarkdownBlocks(input: string) {
  const chunks = input.split(/```/g);
  return chunks.map((value, index) => ({
    type: index % 2 === 0 ? "text" : "code",
    value,
  })) as { type: "text" | "code"; value: string }[];
}

export function HelpAssistantMarkdown({ text, tone }: HelpAssistantMarkdownProps) {
  const blocks = splitMarkdownBlocks(text.trim());

  return (
    <View style={styles.root}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "code") {
          return (
            <View key={`block:${blockIndex}`} style={styles.codeBlock}>
              <Text style={styles.codeBlockText}>{block.value.trim()}</Text>
            </View>
          );
        }

        const lines = block.value.split("\n");
        return (
          <View key={`block:${blockIndex}`} style={styles.textBlock}>
            {lines.map((line, lineIndex) => renderLine(line, lineIndex, tone))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  textBlock: {
    gap: 4,
  },
  lineText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: FinColors.textPrimary,
  },
  assistantText: {
    color: FinColors.textSecondary,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  listPrefix: {
    marginTop: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: FinColors.textSecondary,
    minWidth: 16,
  },
  listPrefixUser: {
    color: FinColors.textPrimary,
  },
  bold: {
    fontWeight: "700",
  },
  italic: {
    fontStyle: "italic",
  },
  inlineCode: {
    fontFamily: "Courier",
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  link: {
    textDecorationLine: "underline",
    color: FinColors.warningText,
  },
  codeBlock: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: "rgba(0,0,0,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  codeBlockText: {
    fontFamily: "Courier",
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
});
