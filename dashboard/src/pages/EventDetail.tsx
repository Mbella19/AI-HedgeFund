import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Folder } from "lucide-react";
import { useFetch } from "../lib/hooks";
import { api } from "../lib/api";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import StatusPill from "../components/ui/StatusPill";

export default function EventDetail() {
  const { id } = useParams();
  const { data, loading } = useFetch(() => api.event(id!), [id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="space-y-5"
    >
      <Link
        to="/runbook"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/10"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to runbook
      </Link>

      <Card>
        <div className="pointer-events-none absolute -top-28 right-10 h-56 w-56 rounded-full bg-sky-500/[0.08] blur-3xl" />
        <div className="relative p-6 md:p-8">
          <div className="eyebrow flex items-center gap-2">
            <Folder className="h-3 w-3" />
            Event folder
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {id}
          </h1>
          {data && (
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill tone="accent">
                {data.files.length} artifact
                {data.files.length !== 1 ? "s" : ""}
              </StatusPill>
              {data.files.includes("diagnosis.md") && (
                <StatusPill tone="accent">diagnosis</StatusPill>
              )}
              {data.files.some((f) => f.startsWith("tweak_")) && (
                <StatusPill tone="warn">tweak</StatusPill>
              )}
              {data.files.includes("proposed_new") && (
                <StatusPill tone="violet">rebuild</StatusPill>
              )}
            </div>
          )}
        </div>
      </Card>

      {loading && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/50 backdrop-blur-xl">
          Loading artifacts…
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {Object.entries(data.content || {}).map(([file, content]) => (
            <Card key={file}>
              <CardHeader
                eyebrow="Artifact"
                title={file}
                icon={<FileText className="h-4 w-4" />}
              />
              <CardContent>
                <pre className="max-h-[600px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-white/70">
                  {content}
                </pre>
              </CardContent>
            </Card>
          ))}
          {Object.keys(data.content || {}).length === 0 && (
            <Card>
              <CardContent>
                <div className="py-6 text-center text-xs text-white/50">
                  No previewable files (.md / .json) in this folder.
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {data.files.map((f) => (
                    <StatusPill key={f} tone="neutral" size="xs">
                      {f}
                    </StatusPill>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
}
