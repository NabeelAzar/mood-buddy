# mood-buddy

A cute animated sidekick (a cat or a robot) that sits in a side pane (or on your Windows desktop) and acts out Claude's mood
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

For the buddy on your Windows desktop too, run `/buddy desktop` and double-click the program it
shows you.

## Idle antics

While nothing is happening, every 15 to 25 seconds the buddy plays a little scene of its own for
5 to 10 seconds, and stops the moment anything happens. About 90 seconds after the last activity
it falls asleep and dreams (letting an antic that's playing finish first). Every 1 to 2 minutes
it wakes up (the cat with a yawn and a big stretch, the robot powering up with a creak), plays
two antics, and dozes off again.

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
- `/buddy desktop` puts the buddy on the Windows desktop too (see below); `/buddy desktop off`
  closes it
- `/buddy status` shows the current mood, character and pane; `/buddy help` lists all of these

## Tuning

- `hooks/moods.ts`: the keyword rules, their weights, and the speech-bubble lines
- `hooks/sprites.ts`: the pose for each mood and the cat and robot drawings
- `hooks/antics.ts`: the idle scenes and dreams, and how long each one plays

## On the Windows desktop

Run `/buddy desktop`. The first time, it builds a small always-on-top window with the same buddy
into `%USERPROFILE%\.claude\mood-buddy\app\` (about 10 seconds), then opens File Explorer with
`MoodBuddy.exe` selected: double-click it. Pin it to Start to reopen it any time; the path never
changes, and `/buddy desktop` rebuilds it there only when a plugin update changes it. The mod
writes each mood, with its drawing, to `%USERPROFILE%\.claude\mood-buddy\state.json`, and the
window redraws whenever that file changes.

- About 820 KB in all: a 15 KB C# program plus Microsoft's WebView2 libraries. It draws with the
  WebView2 Runtime (the Edge engine) that ships with Windows 10 and 11, so nothing else is installed.
- Drag it by the cat or its bubble; it remembers the spot. Right-click it for "Back to the corner"
  and "Close buddy", or run `/buddy desktop off`. Clicks on the empty space around it pass
  through to whatever is behind.
- It follows whichever Claude session with the mod loaded changed mood last, and sits still
  when none is running.
- Claude Code doesn't start it: programs Claude Code starts can run in a sandbox where WebView2
  (like any Chromium) can't start its helper processes and crashes.
- The build is `desktop\build.cmd`, using the C# compiler that ships with Windows. Its first run
  downloads Microsoft's WebView2 SDK (1.0.2903.40, BSD-licensed; the license comes inside the
  package) from nuget.org, checks its SHA-256, and keeps the three DLLs it needs. Where
  `/buddy desktop` can't build (no network, say), it prints the one command to run instead.
  `desktop\build.cmd` with no folder builds into `desktop\build\` for working on the code.
