"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProjectMessageAction } from "@/lib/project-messages/actions";

export interface ProjectConversationMessage {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string;
}

export function ProjectConversation({
  projectId,
  userId,
  messages,
}: {
  projectId: string;
  userId: string;
  messages: ProjectConversationMessage[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProjectMessageAction(projectId, body);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]" aria-labelledby="project-conversation-title">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 id="project-conversation-title" className="font-semibold text-white">Échange sur le projet</h2>
        <p className="mt-1 text-xs text-white/45">Les retours sont visibles ici, dans le Hub.</p>
      </div>

      <div className="max-h-[26rem] space-y-3 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 ? (
          <p className="py-5 text-center text-sm text-white/40">Aucun message pour le moment.</p>
        ) : messages.map((message) => {
          const ownMessage = message.author_id === userId;
          return (
            <article key={message.id} className={`max-w-[90%] rounded-xl px-4 py-3 ${ownMessage ? "ml-auto bg-[#075c1c]/50" : "bg-white/[0.07]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="text-xs font-bold text-white">{ownMessage ? "Vous" : message.author_name}</p>
                <time className="text-[10px] text-white/40" dateTime={message.created_at}>
                  {new Date(message.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80">{message.body}</p>
            </article>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
        {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
        <label htmlFor="project-message" className="sr-only">Votre message</label>
        <textarea
          id="project-message"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={3000}
          rows={3}
          placeholder="Écrivez un retour ou une réponse…"
          className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-[#03A61C]/70 focus:outline-none focus:ring-2 focus:ring-[#03A61C]/20"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-white/35">{body.length}/3000</span>
          <button type="submit" disabled={isPending || !body.trim()} className="rounded-lg bg-[#03A61C] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#05F228] hover:text-black disabled:cursor-not-allowed disabled:opacity-50">
            {isPending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </form>
    </section>
  );
}
