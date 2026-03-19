# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Rube Goldberg Machine Planner** — a browser-based visual planning tool for 5th-grade students to design their Rube Goldberg machines before physically building them. The full PRD is in `Rube-Goldberg-Planner-PRD.md`.

## Tech Stack Decision

Per the PRD: **single-page HTML/JS app with no backend.** Students open a URL — no server infrastructure, no login, no database. Keep it stateless.

## Core Architecture Concepts

### Data Model
- **Components**: draggable items (6 simple machines + materials) placed on a grid canvas
- **Energy links**: connections between component nodes that define cause/effect steps; each link = one step toward the 5-step minimum
- **Project state**: serialized to/from JSON for save/load (no backend)

### Key Features to Implement (P0)
1. Grid canvas with drafting paper aesthetic (blue grid, schematic look)
2. Component library: 6 simple machines (lever, pulley, wedge, wheel & axle, inclined plane, screw) + materials (tubes, buckets, toy cars, string, cups, dominoes, magnets, train tracks, cardboard, tape, boxes)
3. Snap-to-grid drag and drop; connection nodes between components that register energy links
4. Sidebar HUD: tracks unique simple machine types used (target: 3+) and step count via energy links (target: 5+)
5. Text annotations per component/step
6. Export as PNG ("Master Blueprint" — includes canvas, checklist, bill of materials)
7. Save/load via JSON project file download/upload
8. Live bill of materials sidebar (tallies quantities of placed components)

### Requirements Tracking Logic
- Simple machine checklist auto-ticks when a unique machine type is placed (need 3+ distinct types)
- Step counter increments per energy link in the chain (need 5+ links)
- Both update live as components are added/removed

## Constraints
- Must run on Chromebooks in Chrome; all interactions via trackpad/mouse
- No personal data collection, no authentication
- Physics simulation is explicitly out of scope — this is a planning/brainstorming tool only
