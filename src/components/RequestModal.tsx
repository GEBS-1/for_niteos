"use client";

interface RequestModalProps {
  open: boolean;
  onClose: () => void;
}

export function RequestModal({ open, onClose }: RequestModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass rounded-2xl p-8 max-w-md w-full shadow-glow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold mb-2">Заявка отправлена</h3>
        <p className="text-niteos-muted text-sm mb-6">
          В MVP заявка сохраняется локально. Подключите CRM или email-интеграцию для продакшена.
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          <input
            type="text"
            placeholder="Имя"
            className="w-full rounded-xl bg-niteos-surface border border-niteos-border px-4 py-3"
          />
          <input
            type="tel"
            placeholder="Телефон"
            className="w-full rounded-xl bg-niteos-surface border border-niteos-border px-4 py-3"
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-xl bg-niteos-surface border border-niteos-border px-4 py-3"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl electric-gradient text-niteos-bg font-semibold"
          >
            Отправить (демо)
          </button>
        </form>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-sm text-niteos-muted hover:text-niteos-text"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
