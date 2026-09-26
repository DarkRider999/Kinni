// Generates the SubZero user guide as a .docx.
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, PageBreak,
} = require("docx");
const fs = require("fs");

const NEON = "16A594";
const INK = "0B0F14";
const GREY = "667079";

const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 },
  children: [new TextRun({ text: t, bold: true, color: NEON })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 },
  children: [new TextRun({ text: t, bold: true, color: INK })] });
const P = (t, opts = {}) => new Paragraph({ spacing: { after: 120 }, ...opts,
  children: [new TextRun({ text: t, ...opts.run })] });
const Bullet = (t) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 },
  children: [new TextRun(t)] });
const Step = (t) => new Paragraph({ numbering: { reference: "steps", level: 0 }, spacing: { after: 80 },
  children: [new TextRun(t)] });

function featureTable(rows) {
  const widths = [3200, 6160];
  const cell = (text, bold, color) => new TableCell({
    width: { size: text === rows[0][0] ? widths[0] : widths[1], type: WidthType.DXA },
    shading: bold ? { type: ShadingType.CLEAR, fill: INK, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold, color: bold ? "FFFFFF" : "000000" })] })],
  });
  return new Table({
    columnWidths: widths,
    width: { size: widths[0] + widths[1], type: WidthType.DXA },
    rows: rows.map((r, i) => new TableRow({
      children: [
        new TableCell({ width: { size: widths[0], type: WidthType.DXA },
          shading: i === 0 ? { type: ShadingType.CLEAR, fill: INK, color: "auto" } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: r[0], bold: i === 0, color: i === 0 ? "FFFFFF" : "000000" })] })] }),
        new TableCell({ width: { size: widths[1], type: WidthType.DXA },
          shading: i === 0 ? { type: ShadingType.CLEAR, fill: INK, color: "auto" } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: r[1], bold: i === 0, color: i === 0 ? "FFFFFF" : "000000" })] })] }),
      ],
    })),
  });
}

const title = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
  children: [new TextRun({ text: "SubZero", bold: true, size: 72, color: NEON })] });
const subtitle = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
  children: [new TextRun({ text: "A private, end-to-end encrypted messenger", size: 28, color: GREY })] });
const tagline = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320 },
  children: [new TextRun({ text: "Just for us — features & how-to guide", italics: true, size: 22, color: GREY })] });

const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
        style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
      { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1180, right: 1180 } } },
    children: [
      title, subtitle, tagline,

      H1("What is SubZero?"),
      P("SubZero is a messenger we built for the two of us. Messages are protected with the same kind of end-to-end encryption Signal uses, so nobody — not a server, not the network, not anyone in between — can read what we send. It also has a few privacy touches you won't find in a normal chat app: a quick-hide screen with real games and a working calculator, a fingerprint lock, disappearing messages, and the ability to change the app's icon and name on the home screen."),
      P("This guide lists everything it does and shows you how to install and use it.", { run: { italics: true } }),

      H1("Feature list"),
      H2("Messaging & privacy"),
      featureTable([
        ["Feature", "What it does"],
        ["End-to-end encryption", "Every message is encrypted on my phone and only decrypted on yours (X3DH + Double Ratchet, AES-256). No one in the middle can read it."],
        ["Disappearing messages", "Turn on a timer and messages delete themselves after they're read."],
        ["No cloud storage", "Chats live only in the phone's memory while the app is open — nothing is backed up to a server or the cloud."],
        ["Fingerprint / Face lock", "The app is locked behind your biometrics and re-locks whenever you leave it."],
        ["Screenshot protection", "Screenshots are blocked, and the app's preview is hidden in the recent-apps switcher."],
        ["Secure logout", "One tap wipes all messages from the phone's memory — your choice, whenever you want."],
      ]),

      H2("SafeZone — the quick-hide screen"),
      P("Tap the small round button next to the message box and the chat instantly disappears, replaced by an innocent-looking game or calculator. A random one is chosen each time, and it never repeats twice in a row."),
      featureTable([
        ["Screen", "What shows up"],
        ["10 mini-games", "2048, Snake, Sudoku, Tic-Tac-Toe, Memory, Sliding Tiles, Quick Math, Pattern Match, Word Shuffle, Bubble Pop — all fully playable."],
        ["Calculator decoy", "A real, working calculator."],
      ]),
      P("To get back to the chat: double-tap the top-right corner, or press Volume-Down twice. If SafeZone is left open too long, the app locks itself and asks for your fingerprint again."),

      H2("App disguise (identity switching)"),
      P("You can change what the app looks like on the home screen — its name and icon can become Calculator, Notes, Weather, Gallery, or System Update. It's still fully visible in the phone's Settings (it doesn't hide from the system); it just wears a different face on the home screen."),

      H1("How to install the app"),
      P("SubZero installs from an APK file (an Android app file). You only need to do this once each."),
      H2("Step 1 — Get the APK file"),
      Step("I'll send you the file named subzero-debug-apk (a .apk file)."),
      Step("Save it to your phone (Downloads is fine)."),
      H2("Step 2 — Allow installing it"),
      Step("Tap the .apk file. Android will ask permission to install from this source."),
      Step("Tap Settings on that prompt, turn on \"Allow from this source,\" then go back."),
      H2("Step 3 — Install & open"),
      Step("Tap Install, then Open."),
      Step("Set up your fingerprint/Face unlock when it asks — that's your lock for the app."),
      P("Note: this is a personal \"debug\" build, so Android may show a normal \"unknown app\" warning. That's expected for an app shared directly rather than from the Play Store.", { run: { italics: true, color: GREY } }),

      H1("How to use it, day to day"),
      Bullet("Open the app and unlock with your fingerprint."),
      Bullet("Type in the message box and tap Send."),
      Bullet("Someone nearby? Tap the round button by the message box — the chat hides behind a game instantly."),
      Bullet("Double-tap the top-right corner (or press Volume-Down twice) to come back."),
      Bullet("Want messages to vanish? Turn on the disappearing-message timer."),
      Bullet("Leaving your phone? Just switch away — SubZero locks itself automatically."),
      Bullet("Want to clear everything now? Use Secure logout — it wipes all messages from memory."),

      H1("Good to know"),
      Bullet("It's built for privacy between us, honestly and simply — strong encryption, nothing stored in the cloud."),
      Bullet("It does NOT try to destroy evidence or hide from a phone inspection — that's on purpose. It protects your messages; it doesn't pretend to defeat a forensic search."),
      Bullet("Encrypted voice/video calling and the Notes/Weather decoys are planned next."),

      new Paragraph({ spacing: { before: 400 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: NEON, space: 8 } },
        children: [new TextRun({ text: "Made with love. ❄", italics: true, color: GREY })] }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2] || "SubZero-Guide.docx", buf);
  console.log("wrote", process.argv[2] || "SubZero-Guide.docx");
});
