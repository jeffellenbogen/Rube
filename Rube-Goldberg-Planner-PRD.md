# Product Requirements Document: Rube Goldberg Project Planner

**Author:** Jeff Ellenbogen
**Date:** March 19, 2026
**Status:** Draft
**Version:** 1.0

---

## Problem Statement

Fifth-grade students working on Rube Goldberg machine projects need a way to plan and visualize their designs before building with physical materials. Currently, students jump straight into construction without a clear plan, leading to wasted materials, frustration when chain reactions fail, and difficulty meeting project requirements (minimum 5 cause/effect steps, minimum 3 simple machines). A visual planning tool would help students think through their designs systematically and arrive at build day with a clear blueprint.

## Goals

1. **Enable visual planning:** Students can drag and drop components onto a canvas to map out their Rube Goldberg machine before building it physically.
2. **Reinforce science concepts:** The tool reinforces understanding of the six simple machines (lever, pulley, wedge, wheel and axle, inclined plane, screw) by making them first-class components in the planner.
3. **Support project requirements tracking:** Students can see at a glance whether their design meets the minimum 5 cause/effect steps and 3 simple machine types.
4. **Encourage iteration:** Students can rearrange, add, and remove components easily, encouraging them to experiment with different designs before committing to a physical build.
5. **Produce a shareable plan:** Students can export or print their design to use as a reference during the build phase.

## Non-Goals

- **Physics simulation:** The tool does not need to simulate real physics (gravity, momentum, friction). It is a planning/brainstorming tool, not a physics engine.
- **Grading or assessment:** The tool does not score or grade student work. Teachers assess the physical machines and the planning process separately.
- **User accounts or login:** This is a classroom tool. No student accounts, passwords, or personal data collection. Keep it simple and privacy-safe.
- **Mobile-first design:** Students will primarily use this on classroom laptops or Chromebooks. Tablet/phone support is not a priority for v1.
- **Multiplayer/real-time collaboration:** Teams will gather around one device to plan together. No need for simultaneous multi-user editing.

## Target Users

| User | Description | Primary Need |
|------|-------------|--------------|
| **5th-grade student** | Ages 10–11, working in teams of 3–4 | Visually plan their Rube Goldberg machine and check it meets requirements |
| **Teacher (Jeff)** | Assigns the project, reviews plans, supports teams | See that students have a thoughtful plan before they start building |

## User Stories

### Student Stories

- **As a student,** I want to drag simple machine components onto a canvas so that I can plan where each piece of my Rube Goldberg machine goes.
- **As a student,** I want to drag everyday materials (dominoes, toy cars, tubes, cups, etc.) onto the canvas so that I can plan the full chain reaction, not just the simple machines.
- **As a student,** I want to arrange components in a sequence from start to finish so that I can visualize the chain reaction step by step.
- **As a student,** I want to see a checklist that tracks how many simple machine types I've used so that I know if I've met the 3-minimum requirement.
- **As a student,** I want to see a counter for my cause/effect steps so that I know if I've met the 5-minimum requirement.
- **As a student,** I want to label or annotate each step so that I can describe what happens at each stage of the chain reaction (e.g., "the ball rolls down the ramp and hits the lever").
- **As a student,** I want to remove or rearrange components so that I can try different designs without starting over.
- **As a student,** I want to export or print my plan so that I can bring it to the build session as a reference.

### Teacher Stories

- **As the teacher,** I want students to have a structured planning step so that they think critically about cause and effect before building.
- **As the teacher,** I want to see whether a student's plan meets the project requirements (steps, simple machines) so that I can give feedback before build day.

## Requirements

### Must-Have (P0)

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| 1 | **Grid-based drag-and-drop canvas** — A 2D grid workspace with a "drafting paper" aesthetic (blue grid background) where students place and arrange components | Students can drag items from a component library onto a grid canvas. Items snap to the grid for clean alignment. Items can be repositioned by dragging. The canvas has a professional blueprint/drafting paper look. |
| 2 | **Simple machine components** — All 6 simple machines available as draggable items: lever, pulley, wedge, wheel and axle, inclined plane, screw | Each simple machine has a distinct, recognizable visual icon. All 6 types are available in the component library. |
| 3 | **Material components** — Common building materials available as draggable items: tubes, buckets, toy cars, string, cups, dominoes, magnets, train/car tracks, cardboard, tape, boxes | Each material has a distinct icon. All listed materials are available in the component library. |
| 4 | **Connection nodes & energy links** — Components have snap-to connection points; snapping two nodes together registers an "energy link" that defines a cause/effect step | Each component has visible connection nodes. Dragging one component's node near another snaps them together with a visual/audio cue. Each energy link counts as one cause/effect step in the requirements tracker. The chain of links defines the start-to-finish sequence. |
| 5 | **Live requirements tracker (sidebar HUD)** — A persistent sidebar showing progress toward project requirements | Checkboxes that auto-tick when a unique simple machine type is placed (target: 3+). A step counter that increments based on energy links (target: 5+). Updates automatically as students add/remove components. Vibrant green for completed requirements; clear visual distinction for unmet ones. |
| 6 | **Step annotation** — Students can add text descriptions to each step | Each step or component can have a text label or description. Students can describe the cause/effect action (e.g., "ball rolls down ramp and knocks over dominoes"). |
| 7 | **Delete/remove components** — Students can remove items from the canvas | Clicking/selecting a component reveals a delete option. Removing a component updates the requirements tracker. |
| 8 | **Export as "Master Blueprint" PNG** — A "Download Design" button generates a PNG that includes the schematic layout, checklist status, and bill of materials | The exported PNG shows the full canvas with all components, labels, energy links, the requirements checklist, and a bill of materials sidebar. Suitable for printing. |
| 9 | **No login required** — The tool works immediately in a browser with no authentication | The tool loads and is fully functional without any account creation or sign-in. No personal data is collected. |
| 10 | **Runs on Chromebooks** — Works in Chrome browser on typical school hardware | The app loads and runs smoothly in Chrome. All drag-and-drop interactions work with trackpad and mouse. |
| 11 | **Save/load via JSON project file** — Students can download a `.json` project file and upload it later to restore their workspace | "Download Project" saves a JSON file. "Upload Project" restores the full canvas state. Enables iterative design across sessions without any backend or database. |
| 12 | **Bill of materials** — A live sidebar list that tallies quantities of all materials used | Automatically updates as components are added/removed (e.g., "Tape: 2, Tubes: 4, Dominoes: 8"). Included in the exported blueprint PNG. |

### Nice-to-Have (P1)

| # | Requirement | Notes |
|---|-------------|-------|
| 1 | **Component resizing** — Clicking a placed component reveals handles to scale size or change proportions (e.g., making a ramp longer, a pulley wheel larger) | Helps represent different-sized real materials and adds planning precision. |
| 2 | **Audio/visual snap feedback** — Satisfying "snap" sound and visual effect when connection nodes link together | Makes the tool feel responsive and fun. Confirms to students that a link was created. |
| 3 | **Undo/redo** — Standard undo/redo for recent actions | Reduces frustration when students accidentally move or delete something. |
| 4 | **Environment layer** — Draggable "environment" items (desk, floor, stairs, shelf) placed as a foundation before adding machine components | Helps students plan their machine in the context of the physical space where they'll build it. |

### Future Considerations (P2)

| # | Requirement | Rationale |
|---|-------------|-----------|
| 1 | **Simple chain-reaction animation** — A "Play" button that animates a ball or energy flowing through the steps in sequence | Would be engaging and help students visualize the reaction, but adds significant complexity. Design the step-sequencing data model to support this later. |
| 2 | **Template starter designs** — Pre-built example machines students can modify | Helpful for students who struggle to start from scratch, but could reduce creative thinking if introduced too early. |
| 3 | **Team name and project title** — A header area for team name and project title on the exported plan | Nice for presentation purposes but not critical for planning. |

## Success Metrics

### Leading Indicators (within first week of use)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Adoption** | 100% of student teams use the tool during the planning phase | Teacher observation |
| **Plan completion** | 90%+ of teams produce a plan that meets the minimum requirements (5 steps, 3 machines) | Review exported plans |
| **Engagement** | Students spend 15–30 minutes actively planning before wanting to build | Teacher observation |

### Lagging Indicators (after build phase)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Build success rate** | More teams successfully complete a working chain reaction compared to previous years | Teacher comparison |
| **Reduced material waste** | Fewer "start over" moments during the build phase | Teacher observation |
| **Student satisfaction** | Students report the planner was helpful in post-project reflection | Brief class discussion or survey |

## Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Should the canvas be scrollable/zoomable for larger designs, or is a fixed visible area sufficient? | Jeff | No |
| 2 | Should there be explicit "Start" and "End" markers on the canvas to frame the chain reaction? | Jeff | No |
| 3 | How many components should a single design support before performance becomes a concern on Chromebooks? (Need to test) | Engineering | No |
| 4 | Should the component library be organized into categories (Simple Machines / Materials / Environment) with collapsible sections, or a flat list? | Jeff | No |

### Resolved Decisions (from blueprint)

| Decision | Resolution |
|----------|------------|
| Visual style | Professional "drafting paper" look — blue grid background, schematic aesthetic |
| Save mechanism | Stateless — JSON project file download/upload, no backend or database |
| Data collection | Zero data collection, no logins, no persistent server storage |
| Connection model | Snap-to-point "connection nodes" that register "energy links" |

## Timeline Considerations

- **Dependency:** This tool needs to be ready before the Rube Goldberg project build phase begins.
- **Phasing:** Ship the P0 features first and let students use it. P1 features (component resizing, snap feedback, environment layer) can be added based on how the first session goes.
- **Tech stack consideration:** A single-page HTML/JS app with no backend would be the simplest to deploy — students just open a URL. No server infrastructure to maintain.

---

*This is a living document. Update as questions are resolved and feedback comes in from classroom use.*
