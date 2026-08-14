type QuickAction =
  | { label: string; prompt: string }
  | { label: string; view: "automations" };

const ACTIONS: QuickAction[] = [
  { label: "Search Web", prompt: "Search the web for " },
  { label: "List Workspace Files", prompt: "List the files in my workspace." },
  { label: "What do you remember about me?", prompt: "What do you remember about me?" },
  { label: "View Automations", view: "automations" },
];

export function QuickActions({
  onPrompt,
  onNavigate,
}: {
  onPrompt: (text: string) => void;
  onNavigate: (view: "automations") => void;
}) {
  return (
    <div className="quick-actions">
      {ACTIONS.map((action) =>
        "prompt" in action ? (
          <button key={action.label} className="quick-action" onClick={() => onPrompt(action.prompt)}>
            {action.label}
          </button>
        ) : (
          <button key={action.label} className="quick-action" onClick={() => onNavigate(action.view)}>
            {action.label}
          </button>
        ),
      )}
    </div>
  );
}
