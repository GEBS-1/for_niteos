export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-black [&_input]:text-black [&_textarea]:text-black [&_th]:text-black [&_td]:text-black [&_label]:text-black [&_h1]:text-black [&_h2]:text-black [&_p]:text-black [&_span]:text-black [&_button]:text-black placeholder:text-black/40">
      {children}
    </div>
  );
}
