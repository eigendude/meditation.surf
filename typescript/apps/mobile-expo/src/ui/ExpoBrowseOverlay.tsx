/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  BrowseFocusState,
  BrowseHeroContent,
  BrowseMetadataEntry,
  BrowseRowContent,
  BrowseScreenContent,
  BrowseThumbnailContent,
} from "@meditation-surf/browse";
import type { JSX } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";

import type { ExpoBrowseItemInputHandlers } from "../input/ExpoBrowseInputAdapter";

/**
 * @brief Props consumed by the Expo browse overlay
 */
export interface ExpoBrowseOverlayProps {
  readonly browseFocusState: BrowseFocusState;
  readonly content: BrowseScreenContent;
  readonly getItemInputHandlers: (
    rowIndex: number,
    itemIndex: number,
  ) => ExpoBrowseItemInputHandlers;
}

/**
 * @brief Render the browse shell above the live video background on Expo
 *
 * The component stays intentionally presentational. It consumes the shared
 * browse content model and the shared browse focus state, while touch input is
 * translated back into the shared controller by the app-runtime layer.
 *
 * @param props - Browse screen content and focus state prepared by shared code
 *
 * @returns React Native browse overlay UI
 */
export function ExpoBrowseOverlay(
  props: ExpoBrowseOverlayProps,
): JSX.Element | null {
  const heroContent: BrowseHeroContent | null = props.content.hero;

  if (heroContent === null) {
    return null;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.contentContainer}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroSection}>
        <View style={styles.heroTextColumn}>
          <Text numberOfLines={2} style={styles.heroTitle}>
            {heroContent.title}
          </Text>
          <Text style={styles.heroViewCount}>{heroContent.viewCount}</Text>
          <Text numberOfLines={3} style={styles.heroDescription}>
            {heroContent.description}
          </Text>
          <View style={styles.metadataRow}>
            {heroContent.metadataEntries.map(
              (metadataEntry: BrowseMetadataEntry): JSX.Element =>
                metadataEntry.kind === "calendar" ? (
                  <View key={metadataEntry.id} style={styles.calendarItem}>
                    <View style={styles.calendarIcon}>
                      <View style={styles.calendarIconHeader} />
                      <View style={styles.calendarIconBody} />
                    </View>
                    <Text style={styles.calendarText}>
                      {metadataEntry.value}
                    </Text>
                  </View>
                ) : (
                  <View key={metadataEntry.id} style={styles.tagItem}>
                    <Text style={styles.tagText}>{metadataEntry.value}</Text>
                  </View>
                ),
            )}
          </View>
        </View>
      </View>
      {props.content.rows.map(
        (browseRow: BrowseRowContent, rowIndex: number): JSX.Element => (
          <View key={browseRow.id} style={styles.rowSection}>
            <Text style={styles.rowTitle}>{browseRow.title}</Text>
            <ScrollView
              contentContainerStyle={styles.rowTrack}
              horizontal={true}
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
            >
              {browseRow.items.map(
                (
                  thumbnailContent: BrowseThumbnailContent,
                  itemIndex: number,
                ): JSX.Element => {
                  const isFocused: boolean =
                    props.browseFocusState.hasFocusedItem &&
                    props.browseFocusState.activeRowIndex === rowIndex &&
                    (props.browseFocusState.activeItemIndexByRow[rowIndex] ??
                      0) === itemIndex;

                  return (
                    <Pressable
                      key={thumbnailContent.id}
                      {...props.getItemInputHandlers(rowIndex, itemIndex)}
                      style={[
                        styles.thumbnailCard,
                        isFocused ? styles.focusedThumbnailCard : null,
                      ]}
                    >
                      <View
                        style={[
                          styles.thumbnailArtwork,
                          isFocused ? styles.focusedThumbnailArtwork : null,
                        ]}
                      >
                        <Text style={styles.thumbnailMonogram}>
                          {thumbnailContent.artwork.placeholderMonogram}
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={styles.thumbnailTitle}>
                        {thumbnailContent.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.thumbnailMeta}>
                        {thumbnailContent.secondaryText}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </ScrollView>
          </View>
        ),
      )}
    </ScrollView>
  );
}

const styles: {
  readonly contentContainer: ViewStyle;
  readonly heroSection: ViewStyle;
  readonly heroTextColumn: ViewStyle;
  readonly heroTitle: TextStyle;
  readonly heroViewCount: TextStyle;
  readonly heroDescription: TextStyle;
  readonly metadataRow: ViewStyle;
  readonly calendarItem: ViewStyle;
  readonly calendarIcon: ViewStyle;
  readonly calendarIconHeader: ViewStyle;
  readonly calendarIconBody: ViewStyle;
  readonly calendarText: TextStyle;
  readonly tagItem: ViewStyle;
  readonly tagText: TextStyle;
  readonly rowSection: ViewStyle;
  readonly rowTitle: TextStyle;
  readonly rowTrack: ViewStyle;
  readonly thumbnailCard: ViewStyle;
  readonly focusedThumbnailCard: ViewStyle;
  readonly thumbnailArtwork: ViewStyle;
  readonly focusedThumbnailArtwork: ViewStyle;
  readonly thumbnailMonogram: TextStyle;
  readonly thumbnailTitle: TextStyle;
  readonly thumbnailMeta: TextStyle;
} = StyleSheet.create({
  contentContainer: {
    paddingBottom: 48,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  heroSection: {
    marginBottom: 36,
  },
  heroTextColumn: {
    maxWidth: 680,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 10,
    textShadowColor: "#000000",
    textShadowOffset: {
      width: 0,
      height: 3,
    },
    textShadowRadius: 12,
  },
  heroViewCount: {
    color: "#F2F2F2",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    textShadowColor: "#000000",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },
  heroDescription: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 520,
    textShadowColor: "#000000",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 10,
  },
  metadataRow: {
    alignItems: "center",
    columnGap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 20,
    rowGap: 10,
  },
  calendarItem: {
    alignItems: "center",
    flexDirection: "row",
    marginRight: 6,
  },
  calendarIcon: {
    borderColor: "#FFFFFF",
    borderRadius: 5,
    borderWidth: 1,
    height: 18,
    marginRight: 8,
    overflow: "hidden",
    width: 18,
  },
  calendarIconHeader: {
    backgroundColor: "#FFFFFF",
    height: 4,
    width: "100%",
  },
  calendarIconBody: {
    backgroundColor: "#101010",
    flex: 1,
  },
  calendarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "#000000",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },
  tagItem: {
    backgroundColor: "rgba(10, 10, 10, 0.48)",
    borderColor: "rgba(255, 255, 255, 0.48)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "#000000",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 6,
  },
  rowSection: {
    marginBottom: 24,
  },
  rowTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 14,
    textShadowColor: "#000000",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },
  rowTrack: {
    paddingRight: 140,
  },
  thumbnailCard: {
    marginRight: 14,
    width: 170,
  },
  focusedThumbnailCard: {
    transform: [{ scale: 1.03 }],
  },
  thumbnailArtwork: {
    alignItems: "center",
    backgroundColor: "#1F2B39",
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    borderWidth: 1,
    height: 96,
    justifyContent: "center",
    marginBottom: 10,
    overflow: "hidden",
  },
  focusedThumbnailArtwork: {
    backgroundColor: "#29415B",
    borderColor: "rgba(255, 255, 255, 0.92)",
    shadowColor: "#FFFFFF",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.32,
    shadowRadius: 10,
  },
  thumbnailMonogram: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
  },
  thumbnailTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
    textShadowColor: "#000000",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 6,
  },
  thumbnailMeta: {
    color: "#D7D7D7",
    fontSize: 12,
    fontWeight: "600",
  },
});
