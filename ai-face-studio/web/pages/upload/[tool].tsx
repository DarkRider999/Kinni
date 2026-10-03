import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { TopBar } from '../../components/TopBar';
import { UploadDropzone, type UploadedFile } from '../../components/UploadDropzone';
import { ConsentNotice } from '../../components/ConsentNotice';
import { Icon } from '../../components/Icon';
import { getTool, TOOLS } from '../../lib/tools';
import { listCharacters, newId, saveCharacter } from '../../lib/storage';
import { setStaged } from '../../lib/staging';
import type { CharacterProfile, ToolDef } from '../../lib/types';

// Pre-rendered for every known tool id so `npm run build:capacitor` (output: 'export', see
// next.config.js) can produce a static /upload/<tool>.html for each one — the Capacitor Android
// build has no server at runtime to resolve this route dynamically.
export async function getStaticPaths() {
  return { paths: TOOLS.map((t) => ({ params: { tool: t.id } })), fallback: false };
}
export async function getStaticProps() {
  return { props: {} };
}

export default function UploadPage() {
  const router = useRouter();
  const toolId = typeof router.query.tool === 'string' ? router.query.tool : '';
  const tool = getTool(toolId);

  if (!tool) {
    return (
      <>
        <TopBar title="Not found" />
        <div className="flex-1 px-5 py-10 text-center text-[13px] text-white/50">That tool doesn&apos;t exist.</div>
      </>
    );
  }

  if (!tool.available) {
    return (
      <>
        <Head><title>{tool.name} — Coming soon</title></Head>
        <TopBar title={tool.name} />
        <div className="flex flex-1 flex-col items-center gap-4 px-7 pt-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] text-white/40">
            <Icon name={tool.icon as any} size={28} />
          </div>
          <h2 className="text-[16px] font-semibold text-white">Not connected yet</h2>
          <p className="text-[13px] leading-relaxed text-white/50">{tool.unavailableReason}</p>
          <p className="text-[11.5px] text-white/35">
            Upload isn&apos;t offered for this tool — there&apos;s no model to send the photo to, so this screen says so
            instead of pretending to process it.
          </p>
          <button type="button" onClick={() => router.push('/tools')} className="btn-secondary mt-4">Back to Tools</button>
        </div>
      </>
    );
  }

  return <UploadToolView tool={tool} />;
}

function UploadToolView({ tool }: { tool: ToolDef }) {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [characterName, setCharacterName] = useState('');
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCharacters(listCharacters());
  }, []);

  const canUseCharacter = tool.kind !== 'character-create' && characters.length > 0 && files.length < tool.maxUploads;
  const needsName = tool.kind === 'character-create';
  const canContinue = files.length > 0 && consent && (!needsName || characterName.trim().length > 0) && !saving;

  function addCharacterAsFile(c: CharacterProfile) {
    if (files.length >= tool.maxUploads) return;
    setFiles([...files, { id: `char-${c.id}`, fileName: `${c.name}.png`, dataUrl: c.sourceDataUrl, width: 0, height: 0 }]);
  }

  async function handleContinue() {
    if (!canContinue) return;
    setSaving(true);
    if (tool.kind === 'character-create') {
      saveCharacter({ id: newId(), name: characterName.trim(), sourceDataUrl: files[0].dataUrl, createdAt: Date.now() });
      router.push('/profile?created=1');
      return;
    }
    const id = newId();
    setStaged(id, files);
    router.push(`/editor/${tool.id}?staged=${id}`);
  }

  return (
    <>
      <Head><title>{tool.name} — Upload</title></Head>
      <TopBar title={tool.name} />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <p className="mb-4 text-[12.5px] text-white/45">{tool.description}</p>

        {canUseCharacter && (
          <div className="mb-4">
            <div className="mb-2 text-[11px] font-semibold tracking-wide text-white/45">USE A SAVED CHARACTER</div>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {characters.map((c) => (
                <button key={c.id} type="button" onClick={() => addCharacterAsFile(c)} className="flex shrink-0 flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.sourceDataUrl} alt={c.name} className="h-14 w-14 rounded-xl border border-line object-cover" />
                  <span className="text-[10px] text-white/55">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <UploadDropzone files={files} onFilesChange={setFiles} maxFiles={tool.maxUploads} />

        {needsName && files.length > 0 && (
          <div className="mt-4">
            <label className="mb-2 block text-[11px] font-semibold tracking-wide text-white/45">NAME THIS CHARACTER</label>
            <input
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="e.g. My profile identity"
              className="w-full rounded-xl border border-line bg-white/[0.05] px-3.5 py-3 text-[13.5px] text-white placeholder-white/35 outline-none"
            />
          </div>
        )}

        <div className="mt-4">
          <ConsentNotice checked={consent} onChange={setConsent} />
        </div>

        <button type="button" disabled={!canContinue} onClick={handleContinue} className="btn-primary mt-5">
          {tool.kind === 'character-create' ? 'Save character' : 'Continue'}
        </button>
      </div>
    </>
  );
}
