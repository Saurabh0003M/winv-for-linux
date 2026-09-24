'use strict';
/* exported EMOJI_SECTIONS, KAOMOJI, SYMBOLS */
// SPDX-License-Identifier: GPL-2.0-or-later
// Contents of the emoji / kaomoji / symbols tabs. The emoji themselves come from gnome-shell's
// own on-screen-keyboard list at runtime; these are only its section boundaries.

// `first` is the name of the first emoji of each section in
// resource:///org/gnome/shell/osk-layouts/emoji.json (same split as gnome-shell's keyboard.js).
var EMOJI_SECTIONS = [
    { first: 'grinning face', icon: '🙂', name: 'Smileys & people' },
    { first: 'selfie', icon: '👋', name: 'Gestures & clothing' },
    { first: 'monkey face', icon: '🌷', name: 'Animals & nature' },
    { first: 'grapes', icon: '🍔', name: 'Food & drink' },
    { first: 'globe showing Europe-Africa', icon: '🚗', name: 'Travel & places' },
    { first: 'jack-o-lantern', icon: '⚽', name: 'Activities' },
    { first: 'muted speaker', icon: '💡', name: 'Objects' },
    { first: 'ATM sign', icon: '❤️', name: 'Symbols' },
    { first: 'chequered flag', icon: '🚩', name: 'Flags' },
];

var KAOMOJI = [
    { name: 'Classic', items: [':-)', ':)', ';-)', ':-D', 'XD', ':-P', ':-(', ":'(", ':-O', ':-|', ':-/', ':-*', '<3', '</3', 'B-)', '^_^', '^^', '-_-', 'o_O', '>_<', 'T_T', ':3', '=)', '>:(', 'o/', '\\o/'] },
    { name: 'Happy', items: ['(◕‿◕)', '(｡◕‿◕｡)', '(＾▽＾)', '(≧▽≦)', 'ヽ(´▽`)/', '(*^▽^*)', '(✿◠‿◠)', '٩(◕‿◕)۶', '(^_^)', '(￣▽￣)', '(⌒‿⌒)', '(´｡• ᵕ •｡`)', 'ヽ(・∀・)ﾉ', '(o^▽^o)', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '☆*:.｡.o(≧▽≦)o.｡.:*☆'] },
    { name: 'Greeting', items: ['(^_^)/', '(°▽°)/', 'ヾ(^▽^*)', '(￣▽￣)ノ', '( ´ ▽ ` )ﾉ', '(*・ω・)ﾉ', '(✧∀✧)/', 'ヾ(・ω・*)', '(｡･∀･)ﾉﾞ', 'ヽ(＾Д＾)ﾉ', '(^-^)ﾉ', '(〃＾▽＾〃)ノ'] },
    { name: 'Hugging', items: ['(づ｡◕‿‿◕｡)づ', '(っ´▽`)っ', '⊂(´・ω・｀⊂)', '(つ≧▽≦)つ', '⊂(◉‿◉)つ', '(づ￣ ³￣)づ', '(っ＾▿＾)っ', '(⊃｡•́‿•̀｡)⊃', '╰(*´︶`*)╯', '(ノ^_^)ノ'] },
    { name: 'Winking', items: ['(^_-)', '(-_^)', '(^_~)', '☆⌒(ゝ。∂)', '(^_−)☆', '(^_<)〜☆', '(>ω^)', '(^_-)-☆', '(•‿•)', '( ˘ ³˘)'] },
    { name: 'Sorry', items: ['m(_ _)m', '(シ_ _)シ', 'm(。≧ _ ≦｡)m', '<(_ _)>', '(人´∀`)', '(^_^;)', '(・_・;)', '(￣▽￣;)', '(；・∀・)', '(ᵕ—ᴗ—)'] },
    { name: 'Love', items: ['(♥ω♥*)', '(´∀｀)♡', '(◍•ᴗ•◍)❤', '(｡♥‿♥｡)', '♡(ˆ◡ˆ)♡', '(❤ω❤)', '( ˘ ³˘)♥', '(*˘︶˘*).｡.:*♡', '(灬º‿º灬)♡', '(´ε｀ )♡'] },
    { name: 'Laughing', items: ['(≧∇≦)', '(ﾉ≧∀≦)ﾉ', '(*≧▽≦)', '٩(^ᴗ^)۶', '(≧▽≦)ﾉ', '(ᗒᗨᗕ)', 'ヾ(≧▽≦*)o', 'ｗｗｗ', '(＾▽＾)ﾉ', '(*￣▽￣)b'] },
    { name: 'Sad', items: ['(╥﹏╥)', '(ಥ﹏ಥ)', '(T_T)', '(；′⌒`)', '(´；ω；`)', '(｡•́︿•̀｡)', '(ノ_<。)', '(っ˘̩╭╮˘̩)っ', '(´・ω・`)', '(╯︵╰,)'] },
    { name: 'Angry', items: ['(╬ Ò﹏Ó)', '(ಠ_ಠ)', 'ヽ(`Д´)ﾉ', '(＃`Д´)', '(`へ´)', '(・`ω´・)', '(ノಠ益ಠ)ノ', '٩(╬ʘ益ʘ╬)۶', '(╯°□°)╯︵ ┻━┻', '┬─┬ノ( º _ ºノ)', '(ง •̀_•́)ง'] },
    { name: 'Surprised', items: ['(⊙_⊙)', '(°ロ°)', '(O_O)', 'Σ(°△°|||)', '(ﾟДﾟ)', '(⊙ˍ⊙)', 'w(°ｏ°)w', '(°o°)', '(◎_◎;)', '(ʘᗩʘ\')'] },
    { name: 'Animals', items: ['(=^･ω･^=)', '(^・ω・^ )', 'ฅ^•ﻌ•^ฅ', '(=①ω①=)', '(=｀ω´=)', 'ʕ•ᴥ•ʔ', 'ʕ ·(エ)· ʔ', '(•ө•)', 'U・ᴥ・U', '(ᵔᴥᵔ)', '>°))))彡', '/ᐠ｡ꞈ｡ᐟ\\'] },
    { name: 'Other', items: ['¯\\_(ツ)_/¯', '┐(￣ヘ￣)┌', '╮(─▽─)╭', '¯\\(°_o)/¯', '(￢_￢)', '(－‸ლ)', '( ͡° ͜ʖ ͡°)', '(⌐■_■)', '( •_•)>⌐■-■', 'ᕦ(ò_óˇ)ᕤ', '(¬‿¬)', '(ಠ‿ಠ)'] },
];

// One string per category, symbols separated by single spaces.
var SYMBOLS = [
    { name: 'General punctuation', icon: '§', chars: '… – — ‐ • · ‘ ’ “ ” „ ‚ ‹ › « » ¡ ¿ ‼ ⁇ ⁈ ⁉ ‽ § ¶ † ‡ ‰ ‱ ′ ″ ‴ ※ ¦ ‖ ⁂ ⸮ ‸ ⁓ ¨ ´ ˜ ˆ ¸ ¯' },
    { name: 'Currency', icon: '₹', chars: '₹ $ € £ ¥ ¢ ₩ ₽ ₺ ₫ ₪ ₱ ₦ ₴ ₸ ₼ ₾ ₿ ฿ ₲ ₵ ₡ ₭ ₮ ₣ ₤ ₧ ₠ ₢ ₥ ₯ ₰ ₳ ₶ ₷ ₻ ¤ ƒ' },
    { name: 'Latin', icon: 'Ä', chars: 'À Á Â Ã Ä Å Æ Ç È É Ê Ë Ì Í Î Ï Ð Ñ Ò Ó Ô Õ Ö Ø Ù Ú Û Ü Ý Þ ß à á â ã ä å æ ç è é ê ë ì í î ï ð ñ ò ó ô õ ö ø ù ú û ü ý þ ÿ Œ œ Š š Ž ž Ÿ Ł ł Ń ń Ś ś Ź ź Ż ż Ą ą Ć ć Ę ę Ğ ğ İ ı Ş ş' },
    { name: 'Geometric', icon: '◆', chars: '■ □ ▢ ▣ ▤ ▥ ▦ ▧ ▨ ▩ ▪ ▫ ▬ ▭ ▮ ▯ ▰ ▱ ▲ △ ▴ ▵ ▶ ▷ ▸ ▹ ► ▻ ▼ ▽ ▾ ▿ ◀ ◁ ◂ ◃ ◄ ◅ ◆ ◇ ◈ ◉ ◊ ○ ◌ ◍ ◎ ● ◐ ◑ ◒ ◓ ◔ ◕ ◖ ◗ ◢ ◣ ◤ ◥ ◦ ◯ ★ ☆ ✦ ✧ ✪ ✫ ✬ ✭ ✮ ✯ ✰' },
    { name: 'Math', icon: '∑', chars: '+ − × ÷ ± ∓ = ≠ ≈ ≃ ≅ ≡ ≢ ≤ ≥ ≪ ≫ ∝ ∞ √ ∛ ∜ ∑ ∏ ∐ ∫ ∬ ∭ ∮ ∂ ∆ ∇ ∀ ∃ ∄ ∈ ∉ ∋ ⊂ ⊃ ⊆ ⊇ ∩ ∪ ∅ ∧ ∨ ¬ ⊕ ⊗ ⊥ ∥ ∠ ° ′ ″ ∴ ∵ ∼ ≜ ⌊ ⌋ ⌈ ⌉ ⟨ ⟩ ℕ ℤ ℚ ℝ ℂ ℏ ℓ ½ ⅓ ⅔ ¼ ¾ ⅕ ⅛ ⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁿ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉' },
    { name: 'Arrows', icon: '→', chars: '← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙ ↩ ↪ ↺ ↻ ⇐ ⇑ ⇒ ⇓ ⇔ ⇕ ⇄ ⇅ ⇆ ⇋ ⇌ ⟵ ⟶ ⟷ ⟸ ⟹ ⟺ ➔ ➜ ➝ ➞ ➟ ➠ ⤴ ⤵ ↯ ⟲ ⟳' },
    { name: 'Supplemental', icon: '✓', chars: '✓ ✔ ✗ ✘ ☐ ☑ ☒ ♠ ♣ ♥ ♦ ♤ ♧ ♡ ♢ ♩ ♪ ♫ ♬ ☀ ☁ ☂ ☃ ☄ ☎ ☘ ☠ ☢ ☣ ☮ ☯ ☹ ☺ ♀ ♂ ⚠ ⚡ ⚙ ⚛ ⌘ ⌥ ⇧ ⌫ ⏎ ⎋ ⌨ ™ © ® ℠ № ℃ ℉ Ω µ Å ⏻' },
    { name: 'Greek', icon: 'α', chars: 'Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ ς τ υ φ χ ψ ω ϑ ϕ ϖ ϵ' },
];
