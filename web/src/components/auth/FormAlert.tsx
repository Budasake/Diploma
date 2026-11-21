import { CircleAlert } from "lucide-react";

export default function FormAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}
