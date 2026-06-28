STREAMHUB — HYBRID VIDEO PLATFORM
=================================

Three independent applications sharing one design system and data model:

  1. Viewer            — premium streaming experience (Netflix/YouTube style)
  2. Creator Studio    — upload, analytics, revenue, AI tools, APIs
  3. Platform Manager  — the company OS: users, moderation, infra, governance


HOW TO RUN
----------
Mac:     Double-click  Start.command
         (First time blocked? Right-click -> Open -> Open.)
Windows: Double-click  Start.bat

Your browser opens index.html — the persona selector. Pick an experience.
Keep the small terminal/command window open while using it; close it to stop.

Requires Python 3 (preinstalled on Mac; Windows users get it from
https://www.python.org/downloads/ if the launcher asks).


PROJECT STRUCTURE
-----------------
  index.html                       Persona selector (start here)
  viewer/viewer-app.html           Viewer application
  creator/creator-studio.html      Creator Studio application
  manager/platform-manager.html    Platform Manager application
  media/                           Shared video files (used by all three)
  Start.command / Start.bat        Launchers

  Source + build (for editing):
  _shared.css   Shared design system (colors, components, layout)
  _data.js      Shared sample data model + shared components
  */_*.src.html Per-app source templates
  build.js      Run "node build.js" to re-inline shared files into the apps


NOTES
-----
- The three apps are self-contained HTML (design system + data inlined),
  so each opens on its own. They all read videos from the shared media/ folder.
- Opening the .html files directly (file://) works, but video scrubbing is
  smoother through the launcher's local server. Use Start.command / Start.bat.
- To change the design once for all three: edit _shared.css (or _data.js),
  then run "node build.js" and re-share.
