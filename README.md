# mood-buddy

A cute animated sidekick (a cat or a robot) that sits in a side pane (or on your Windows desktop) and acts out Claude's mood
while it works: listening when you send a message, thinking while Claude reasons, typing while
it runs tools, a magnifying glass while it searches, a raised paw when it corrects you, flat ears
when it disapproves, and a happy bounce when it finishes.

It uses no AI and no credits. The mood comes from the session's own events (prompt sent,
thinking, tool calls, errors, turn finished) and a small table of keyword rules applied to the
reply text as it streams. The animation lives inside the SVG, so the pane only redraws when
the mood changes.

I've found it handy to run in one chat while working in another.  The sidekick activities let's me know what's happening there in a visual way.

Works in Claude Code: the terminal, the IDE extensions, and the Claude desktop app's Code tab.
The optional desktop buddy is Windows 10 and 11 only.

## What it does on your computer

mood-buddy sends nothing over the network, calls no model, and collects no telemetry. Below,
`~/.claude` means Claude Code's `.claude` folder, the one this plugin is installed in.

### What its hooks do

mood-buddy is a Claude Code mod: code in `hooks/register.tsx` that Claude Code runs on these
events. None of them changes, blocks or delays what Claude does; each only watches.

- `session.start`: adds the `/buddy` command, reads your saved character and whether you hid the
  buddy, and opens the Buddy pane.
- `command.run` for `/buddy`: answers the `/buddy` commands listed under [Use](#use).
- `prompt.submit`: shows the "listening" mood when you send a message.
- `turn.step`: as Claude's reply streams, shows "thinking", "talking" or a tool mood, and scores
  the last 400 characters of the reply against the keyword rules in `hooks/moods.ts`. The reply
  passes through unchanged.
- `tool.call`: shows "working" or "searching" by the tool's name, and "oops" if the tool fails.
  The call passes through unchanged.
- `turn.complete`: shows "happy" ("disapproving" after a refusal, "oops" after an error), then
  starts the idle and nap cycle.
- `ui.render`: draws the Buddy pane, and the small buddy above the prompt when the pane is closed.

It adds one command, `/buddy`, and no tools or agents.

### What it reads

The events above, kept in memory only, to pick a mood. Nothing else: no environment variables,
credentials or other files. It finds `~/.claude` from the folder it's installed in.

### What it writes

- In Claude Code's plugin storage: your character choice and whether you hid the buddy.
- `~/.claude/mood-buddy/state.json`: the current mood, its speech-bubble line, the character and
  its drawing, for the desktop buddy. Never any conversation text.
- `~/.claude/mood-buddy/control.json`: a request for the desktop buddy to close
  (`/buddy desktop off`, or before an update).
- Only for `/buddy desktop`: the desktop buddy program in `~/.claude/mood-buddy/app/`, with
  `app/lib/` (the WebView2 SDK files) and `app/source.sha256` (which version of the source it was
  built from).

It writes no build, start-up, settings or instructions file.

### What it sends, and where

Nothing leaves your computer. Inside it: the mood goes to Claude Code's status line and pane, and
to `state.json` for the desktop buddy. `/buddy desktop` puts the desktop buddy's path on your
clipboard (Claude Code's `$.ui.copy` call, which writes the clipboard of the app you're using) so
you can paste it into Win+R.

### What programs it runs, and why

Only when you run `/buddy desktop`, and only if the desktop buddy isn't built yet or this
plugin's update changed it: `cmd.exe` runs `desktop\build.cmd` from this plugin, to build the
desktop buddy on your machine from the source in this repository instead of shipping a compiled
program. `build.cmd` runs only Windows' own programs:

- the .NET Framework C# compiler (`csc.exe`), to compile `desktop\MoodBuddy.cs`;
- `curl.exe`, once, to download Microsoft's WebView2 SDK, version 1.0.2903.40, from nuget.org;
- `certutil.exe` and `findstr.exe`, to check that download against a pinned SHA-256 before using
  it;
- `tar.exe`, to unpack the three WebView2 files the program needs.

The mod never starts the desktop buddy; you do.

### The desktop buddy

`MoodBuddy.exe`, built from `desktop\MoodBuddy.cs`, shows a page from a file beside it (it
fetches nothing from the internet), reads `state.json` and `control.json`, and saves its window
position to `window.txt` and its browser profile to `webview2\` in `~/.claude/mood-buddy/`, the
folder one up from its own. It reads no environment variables. To let you
drag the buddy and right-click it while clicks elsewhere pass through, it uses a Windows
low-level mouse hook. The hook sees where the pointer is and which button is pressed, acts only
on presses over the cat or its speech bubble, and never records or sends anything.

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

While the repository is private, it installs only for people who can read it on GitHub and whose
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
into `~/.claude/mood-buddy/app/` (about 10 seconds) and tells you how to start it:
press Win+R, paste the path (it's put on your clipboard where the app allows), Enter. Pin it to
Start to reopen it any time; the path never changes, and `/buddy desktop` rebuilds it there only
when a plugin update changes it. The mod
writes each mood, with its drawing, to `~/.claude/mood-buddy/state.json`, and the
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
