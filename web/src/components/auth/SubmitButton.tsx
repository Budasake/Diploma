import { LoaderCircle } from "lucide-react";

export default function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-6 py-3 font-medium text-white shadow-lg shadow-violet-500/30 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
