/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { HtmlTagDescriptor } from "vite";

import sharedSiteMetadataJson from "./SiteMetadata.json";

/**
 * @brief Shared metadata values for meditation.surf app surfaces
 *
 * Browser-facing apps can derive their `<head>` metadata from this model,
 * while native-style app configs can reuse the same title, description, and
 * canonical URL fields without hand-maintaining duplicate strings.
 */
export interface SiteMetadata {
  /**
   * @brief Human-readable application title
   */
  readonly title: string;

  /**
   * @brief Primary plain-text description used by search and app config fields
   */
  readonly description: string;

  /**
   * @brief Canonical public home page URL
   */
  readonly canonicalUrl: string;

  /**
   * @brief Primary document language for browser HTML shells
   */
  readonly lang: string;

  /**
   * @brief Primary document direction for browser HTML shells
   */
  readonly dir: string;

  /**
   * @brief Open Graph locale code shared by browser-facing builds
   */
  readonly locale: string;

  /**
   * @brief Human-readable installable application name
   */
  readonly applicationName: string;

  /**
   * @brief Path to the shared web app manifest
   */
  readonly manifestPath: string;

  /**
   * @brief Shared browser UI theme color
   */
  readonly themeColor: string;

  /**
   * @brief Shared application background color
   */
  readonly backgroundColor: string;

  /**
   * @brief Shared installable application launch URL
   */
  readonly startUrl: string;

  /**
   * @brief Shared navigation scope for installable browser builds
   */
  readonly scope: string;

  /**
   * @brief Preferred PWA display mode
   */
  readonly display: string;

  /**
   * @brief Browser display fallbacks ordered by preference
   */
  readonly displayOverride: readonly string[];

  /**
   * @brief Preferred screen orientation for the installed experience
   */
  readonly orientation: string;

  /**
   * @brief Apple status bar style used when launched from the iOS home screen
   */
  readonly appleMobileWebAppStatusBarStyle: string;

  /**
   * @brief Shared installable app categories used by the web manifest
   */
  readonly categories: readonly string[];

  /**
   * @brief Open Graph content type for the site root
   */
  readonly openGraphType: string;

  /**
   * @brief Shared social preview image path rooted at the website origin
   */
  readonly imagePath: string;

  /**
   * @brief Absolute social preview image URL
   */
  readonly imageUrl: string;

  /**
   * @brief Twitter card style shared by browser builds
   */
  readonly twitterCard: string;
}

/**
 * @brief Metadata values that are stored directly in `SiteMetadata.json`
 */
type StaticSiteMetadata = Omit<SiteMetadata, "imageUrl">;

/**
 * @brief Property-based social metadata tag descriptor input
 */
interface PropertyMetadataTagDefinition {
  /**
   * @brief Metadata property name
   */
  readonly property: string;

  /**
   * @brief Metadata property value
   */
  readonly content: string;
}

/**
 * @brief Name-based metadata tag descriptor input
 */
interface NamedMetadataTagDefinition {
  /**
   * @brief Metadata name attribute
   */
  readonly name: string;

  /**
   * @brief Metadata content attribute
   */
  readonly content: string;
}

/**
 * @brief Link tag descriptor input
 */
interface LinkTagDefinition {
  /**
   * @brief Link relationship value
   */
  readonly rel: string;

  /**
   * @brief Link destination URL or path
   */
  readonly href: string;

  /**
   * @brief Optional MIME type for the linked resource
   */
  readonly type?: string;

  /**
   * @brief Optional icon dimensions string
   */
  readonly sizes?: string;
}

/**
 * @brief Parsed metadata loaded from `SiteMetadata.json`
 */
const sharedSiteMetadata: StaticSiteMetadata = sharedSiteMetadataJson;

/**
 * @brief Canonical metadata for meditation.surf
 */
export const SITE_METADATA: SiteMetadata = {
  ...sharedSiteMetadata,
  imageUrl: `https://meditation.surf${sharedSiteMetadata.imagePath}`,
};

/**
 * @brief Build a shared document title tag
 *
 * @param titleText Visible document title
 *
 * @returns Title tag descriptor for Vite HTML transforms
 */
function createTitleTag(titleText: string): HtmlTagDescriptor {
  return {
    tag: "title",
    children: titleText,
    injectTo: "head",
  };
}

/**
 * @brief Build a `<meta name="...">` tag
 *
 * @param metadataName HTML metadata name
 *
 * @param metadataContent HTML metadata content
 *
 * @returns Name-based meta tag descriptor
 */
function createNamedMetaTag(
  metadataName: string,
  metadataContent: string,
): HtmlTagDescriptor {
  return {
    tag: "meta",
    attrs: {
      name: metadataName,
      content: metadataContent,
    },
    injectTo: "head",
  };
}

/**
 * @brief Build a `<meta property="...">` tag
 *
 * @param metadataProperty Social metadata property
 *
 * @param metadataContent Social metadata content
 *
 * @returns Property-based meta tag descriptor
 */
function createPropertyMetaTag(
  metadataProperty: string,
  metadataContent: string,
): HtmlTagDescriptor {
  return {
    tag: "meta",
    attrs: {
      property: metadataProperty,
      content: metadataContent,
    },
    injectTo: "head",
  };
}

/**
 * @brief Build the canonical link tag for the site root
 *
 * @param canonicalUrl Canonical page URL
 *
 * @returns Canonical link descriptor
 */
function createCanonicalLinkTag(canonicalUrl: string): HtmlTagDescriptor {
  return {
    tag: "link",
    attrs: {
      rel: "canonical",
      href: canonicalUrl,
    },
    injectTo: "head",
  };
}

/**
 * @brief Build a generic `<link rel="...">` tag
 *
 * @param linkTag Link descriptor source values
 *
 * @returns Link tag descriptor for Vite HTML transforms
 */
function createLinkTag(linkTag: LinkTagDefinition): HtmlTagDescriptor {
  const attrs: Record<string, string> = {
    rel: linkTag.rel,
    href: linkTag.href,
  };

  if (linkTag.type !== undefined) {
    attrs.type = linkTag.type;
  }

  if (linkTag.sizes !== undefined) {
    attrs.sizes = linkTag.sizes;
  }

  return {
    tag: "link",
    attrs,
    injectTo: "head",
  };
}

/**
 * @brief Build the shared app-shell tags injected into browser app HTML
 *
 * These tags describe installability and shell identity, while the page-level
 * SEO and social tags remain below in the same shared transform.
 *
 * @returns Ordered HTML tag descriptors for the document head
 */
function createSharedAppShellHtmlTags(): HtmlTagDescriptor[] {
  const applicationTitle: string = SITE_METADATA.applicationName;
  const themeColor: string = SITE_METADATA.themeColor;
  const iconPath: string = SITE_METADATA.imagePath;
  const iconSize: string = "1500x1500";

  const shellLinkTags: LinkTagDefinition[] = [
    {
      rel: "manifest",
      href: SITE_METADATA.manifestPath,
      type: "application/manifest+json",
    },
    {
      rel: "icon",
      href: iconPath,
      type: "image/png",
      sizes: iconSize,
    },
    {
      rel: "apple-touch-icon",
      href: iconPath,
      sizes: iconSize,
    },
  ];

  const shellMetaTags: NamedMetadataTagDefinition[] = [
    {
      name: "application-name",
      content: applicationTitle,
    },
    {
      name: "theme-color",
      content: themeColor,
    },
    {
      name: "mobile-web-app-capable",
      content: "yes",
    },
    {
      name: "apple-mobile-web-app-capable",
      content: "yes",
    },
    {
      name: "apple-mobile-web-app-title",
      content: applicationTitle,
    },
    {
      name: "apple-mobile-web-app-status-bar-style",
      content: SITE_METADATA.appleMobileWebAppStatusBarStyle,
    },
  ];

  const htmlTags: HtmlTagDescriptor[] = [
    ...shellLinkTags.map(
      (linkTag: LinkTagDefinition): HtmlTagDescriptor => createLinkTag(linkTag),
    ),
    ...shellMetaTags.map(
      (metadataTag: NamedMetadataTagDefinition): HtmlTagDescriptor =>
        createNamedMetaTag(metadataTag.name, metadataTag.content),
    ),
  ];

  return htmlTags;
}

/**
 * @brief Build the shared `<head>` tags injected into browser app HTML
 *
 * The returned descriptors are consumed by Vite's `transformIndexHtml` hook so
 * each app can keep a minimal HTML shell while still rendering the same social
 * and canonical metadata.
 *
 * @returns Ordered HTML tag descriptors for the document head
 */
export function createSharedSiteMetadataHtmlTags(): HtmlTagDescriptor[] {
  const sharedTitle: string = SITE_METADATA.title;
  const sharedDescription: string = SITE_METADATA.description;
  const canonicalUrl: string = SITE_METADATA.canonicalUrl;

  const openGraphMetadata: PropertyMetadataTagDefinition[] = [
    {
      property: "og:type",
      content: SITE_METADATA.openGraphType,
    },
    {
      property: "og:url",
      content: canonicalUrl,
    },
    {
      property: "og:title",
      content: sharedTitle,
    },
    {
      property: "og:description",
      content: sharedDescription,
    },
    {
      property: "og:image",
      content: SITE_METADATA.imageUrl,
    },
    {
      property: "og:locale",
      content: SITE_METADATA.locale,
    },
  ];

  const twitterMetadata: PropertyMetadataTagDefinition[] = [
    {
      property: "twitter:card",
      content: SITE_METADATA.twitterCard,
    },
    {
      property: "twitter:url",
      content: canonicalUrl,
    },
    {
      property: "twitter:title",
      content: sharedTitle,
    },
    {
      property: "twitter:description",
      content: sharedDescription,
    },
    {
      property: "twitter:image",
      content: SITE_METADATA.imageUrl,
    },
  ];

  const htmlTags: HtmlTagDescriptor[] = [
    ...createSharedAppShellHtmlTags(),
    createTitleTag(sharedTitle),
    createNamedMetaTag("description", sharedDescription),
    createCanonicalLinkTag(canonicalUrl),
    ...openGraphMetadata.map(
      (metadataTag: PropertyMetadataTagDefinition): HtmlTagDescriptor =>
        createPropertyMetaTag(metadataTag.property, metadataTag.content),
    ),
    ...twitterMetadata.map(
      (metadataTag: PropertyMetadataTagDefinition): HtmlTagDescriptor =>
        createPropertyMetaTag(metadataTag.property, metadataTag.content),
    ),
  ];

  return htmlTags;
}
