import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { TopBar } from '../../components/TopBar';
import { SingleEditor } from '../../components/SingleEditor';
import { BatchRunner } from '../../components/BatchRunner';
import { AnalysisRunner } from '../../components/AnalysisRunner';
import type { UploadedFile } from '../../components/UploadDropzone';
import { getTool, TOOLS } from '../../lib/tools';
import { getStaged } from '../../lib/staging';

// See pages/upload/[tool].tsx — same reason: static export needs every path pre-rendered.
export async function getStaticPaths() {
  return { paths: TOOLS.map((t) => ({ params: { tool: t.id } })), fallback: false };
}
export async function getStaticProps() {
  return { props: {} };
}

export default function EditorPage() {
  const router = useRouter();
  const toolId = typeof router.query.tool === 'string' ? router.query.tool : '';
  const stagedId = typeof router.query.staged === 'string' ? router.query.staged : '';
  const tool = getTool(toolId);
  const [files, setFiles] = useState<UploadedFile[] | null>(null);

  useEffect(() => {
    if (!stagedId) return;
    setFiles(getStaged(stagedId));
  }, [stagedId]);

  if (!tool) return null;

  if (files === null) {
    return (
      <>
        <TopBar title={tool.name} />
        <div className="flex-1 px-5 py-10 text-center text-[13px] text-white/50">Loading…</div>
      </>
    );
  }

  if (files.length === 0) {
    return (
      <>
        <TopBar title={tool.name} />
        <div className="flex flex-1 flex-col items-center gap-3 px-5 py-10 text-center text-[13px] text-white/50">
          <p>No photo found for this session — upload one first.</p>
          <button type="button" onClick={() => router.push(`/upload/${tool.id}`)} className="btn-secondary">Go to Upload</button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>{tool.name} — Editor</title></Head>
      <TopBar title={tool.name} />
      {tool.kind === 'analysis' ? (
        <AnalysisRunner toolId={tool.id} toolName={tool.name} file={files[0]} />
      ) : tool.maxUploads > 1 ? (
        <BatchRunner tool={tool} files={files} />
      ) : (
        <SingleEditor tool={tool} file={files[0]} />
      )}
    </>
  );
}
