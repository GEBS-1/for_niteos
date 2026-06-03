export function Header() {
  return (
    <header className="border-b border-niteos-border/60 bg-niteos-surface/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg electric-gradient flex items-center justify-center shadow-glow">
            <span className="text-niteos-bg font-bold text-lg">N</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              NITE<span className="text-niteos-electric">OS</span>
            </h1>
            <p className="text-xs text-niteos-muted">
              Конфигуратор архитектурной подсветки
            </p>
          </div>
        </div>
        <span className="hidden sm:inline text-xs text-niteos-muted px-3 py-1 rounded-full border border-niteos-border">
          MVP · Каталог NITEOS
        </span>
      </div>
    </header>
  );
}
