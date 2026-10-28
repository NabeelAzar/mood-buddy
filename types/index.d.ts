export type Mood =
  | 'idle'
  | 'sleepy'
  | 'listening'
  | 'thinking'
  | 'talking'
  | 'working'
  | 'searching'
  | 'correcting'
  | 'disapproving'
  | 'happy'
  | 'apologetic'
  | 'curious'
  | 'oops'

export type Skin = 'cat' | 'robot'

// Little things a character does on its own while idle.
export type Antic =
  | 'groom'
  | 'yarn'
  | 'butterfly'
  | 'cup'
  | 'loaf'
  | 'recharge'
  | 'radio'
  | 'oil'
  | 'juggle'
  | 'scan'
  | 'reboot'
  | 'stretch'
  | 'powerup'

export type BuddyMood = { mood: Mood; bubble: string; antic?: Antic }

declare module 'claude-code' {
  interface PluginState {
    'mood-buddy': {
      mood: Shaped<BuddyMood>
      skin: Shaped<Skin>
      hidden: Shaped<boolean>
    }
  }
}
