# mood-buddy

A cute animated sidekick (a cat or a robot) that sits in a side pane and acts out Claude's mood
while it works: listening when you send a message, thinking while Claude reasons, typing while
it runs tools, a magnifying glass while it searches, a raised paw when it corrects you, flat ears
when it disapproves, and a happy bounce when it finishes.

It uses no AI and no credits. The mood comes from the session's own events (prompt sent,
thinking, tool calls, errors, turn finished) and a small table of keyword rules applied to the
reply text as it streams. The animation lives inside the SVG, so the pane only redraws when
the mood changes.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install mood-buddy --marketplace NabeelAzar/mood-buddy
```

From a shell:

```
claude plugin install mood-buddy --marketplace NabeelAzar/mood-buddy
```

In the Claude desktop app, where `/plugin` doesn't run: click + next to the prompt box, then
Plugins, Add marketplace with `NabeelAzar/mood-buddy`, then Add plugin.

The repository is private, so it installs only for people who can read it on GitHub and whose
computer already has a git login for github.com (an SSH key, or `gh auth login` then
`gh auth setup-git`): the install never asks for one.

For the desktop buddy, run `desktop\build.cmd` once after installing; it builds
`desktop\build\MoodBuddy.exe` with the C# compiler that ships with Windows.

## Idle antics

While nothing is happening, every 20 to 40 seconds the buddy plays a little scene of its own for a
few seconds, and stops the moment anything happens. After 90 seconds it falls asleep and dreams.

- Cat: grooms, bats a ball of yarn, watches and pounces on a butterfly, pushes a cup off a table,
  loafs and purrs. Dreams of a mouse.
- Robot: recharges, bops to the radio, oils a squeaky joint, juggles bolts (and drops one), scans
  for a fly with a laser, reboots. Dreams in floating 1s and 0s.

## Use

- `/buddy` opens the pane
- `/buddy off` hides the buddy inside Claude (pane, band above the prompt and status line) until
  the next `/buddy`; the choice is remembered across sessions
- `/buddy cat` or `/buddy robot` picks the character (remembered across sessions)
- The "Switch to …" button in the pane does the same
- `/buddy desktop` says how to put the buddy on the Windows desktop too (see below)
- `/buddy status` shows the current mood, character and pane; `/buddy help` lists all of these

## Tuning

- `hooks/moods.ts`: the keyword rules, their weights, and the speech-bubble lines
- `hooks/sprites.ts`: the pose for each mood and the cat and robot drawings
- `hooks/antics.ts`: the idle scenes and dreams, and how long each one plays

## On the Windows desktop

`desktop\build\MoodBuddy.exe` is a small always-on-top window with the same buddy, outside Claude.
Open it from File Explorer (pin it to Start to reopen it later). The mod writes each mood, with its
drawing, to `%USERPROFILE%\.claude\mood-buddy\state.json`, and the window redraws whenever that
file changes.

- About 820 KB in all: an 11 KB C# program plus Microsoft's WebView2 libraries. It draws with the
  WebView2 Runtime (the Edge engine) that ships with Windows 10 and 11, so nothing else is installed.
- Drag it by the cat or its bubble; it remembers the spot. Right-click it for "Back to the corner"
  and "Close buddy", or run `/buddy desktop off`. Clicks on the empty space around it pass
  through to whatever is behind.
- It follows whichever Claude session with the mod loaded changed mood last, and sits still
  when none is running.
- Claude Code doesn't start it: programs Claude Code starts can run in a sandbox where WebView2
  (like any Chromium) can't start its helper processes and crashes.
- To rebuild it, run `desktop\build.cmd`, which uses the C# compiler that ships with Windows.
  On its first run it downloads Microsoft's WebView2 SDK (1.0.2903.40, BSD-licensed; the license
  comes inside the package) from nuget.org, checks its SHA-256, and keeps the three DLLs it needs
  in `desktop\lib\`, which it creates and git ignores.
